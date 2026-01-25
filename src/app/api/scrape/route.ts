import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { ScrapedRecipe } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch URL' }, { status: 400 });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Try to find JSON-LD structured data first (most reliable)
    let recipe = tryParseJsonLd($);

    // If no JSON-LD, try common recipe patterns
    if (!recipe) {
      recipe = tryParseCommonPatterns($, url);
    }

    // If still nothing, do a basic extraction
    if (!recipe) {
      recipe = basicExtraction($, url);
    }

    return NextResponse.json(recipe);
  } catch (error) {
    console.error('Scraping error:', error);
    return NextResponse.json(
      { error: 'Failed to scrape recipe' },
      { status: 500 }
    );
  }
}

function tryParseJsonLd($: cheerio.CheerioAPI): ScrapedRecipe | null {
  try {
    const scripts = $('script[type="application/ld+json"]');

    for (let i = 0; i < scripts.length; i++) {
      const content = $(scripts[i]).html();
      if (!content) continue;

      let data = JSON.parse(content);

      // Handle array of objects
      if (Array.isArray(data)) {
        data = data.find((d) => d['@type'] === 'Recipe' || d['@type']?.includes('Recipe'));
      }

      // Handle @graph
      if (data['@graph']) {
        data = data['@graph'].find((d: Record<string, unknown>) =>
          d['@type'] === 'Recipe' || (Array.isArray(d['@type']) && d['@type'].includes('Recipe'))
        );
      }

      if (data && (data['@type'] === 'Recipe' || data['@type']?.includes?.('Recipe'))) {
        return {
          title: data.name || '',
          description: data.description || null,
          image_url: extractImage(data.image),
          ingredients: extractIngredients(data.recipeIngredient),
          instructions: extractInstructions(data.recipeInstructions),
          prep_time: parseDuration(data.prepTime),
          cook_time: parseDuration(data.cookTime),
          servings: parseServings(data.recipeYield),
        };
      }
    }
  } catch (e) {
    console.error('JSON-LD parsing error:', e);
  }
  return null;
}

function tryParseCommonPatterns($: cheerio.CheerioAPI, url: string): ScrapedRecipe | null {
  // Common class/id patterns for recipe sites
  const titleSelectors = [
    'h1.recipe-title', 'h1.entry-title', '.recipe-name',
    '[itemprop="name"]', 'h1', '.wprm-recipe-name'
  ];

  const ingredientSelectors = [
    '.ingredients li', '.ingredient', '[itemprop="recipeIngredient"]',
    '.recipe-ingredients li', '.wprm-recipe-ingredient'
  ];

  const instructionSelectors = [
    '.instructions li', '.instruction', '[itemprop="recipeInstructions"]',
    '.recipe-instructions li', '.wprm-recipe-instruction'
  ];

  let title = '';
  for (const selector of titleSelectors) {
    const found = $(selector).first().text().trim();
    if (found) {
      title = found;
      break;
    }
  }

  if (!title) return null;

  const ingredients: string[] = [];
  for (const selector of ingredientSelectors) {
    $(selector).each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 2) {
        ingredients.push(text);
      }
    });
    if (ingredients.length > 0) break;
  }

  const instructions: string[] = [];
  for (const selector of instructionSelectors) {
    $(selector).each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 5) {
        instructions.push(text);
      }
    });
    if (instructions.length > 0) break;
  }

  // Get image
  let imageUrl = null;
  const imgSelectors = [
    '.recipe-image img', '[itemprop="image"]', '.entry-content img',
    'article img', '.post-thumbnail img'
  ];

  for (const selector of imgSelectors) {
    const img = $(selector).first();
    const src = img.attr('src') || img.attr('data-src');
    if (src) {
      imageUrl = src.startsWith('http') ? src : new URL(src, url).href;
      break;
    }
  }

  // Get description
  const description = $('meta[name="description"]').attr('content') ||
    $('[itemprop="description"]').first().text().trim() ||
    null;

  return {
    title,
    description,
    image_url: imageUrl,
    ingredients,
    instructions,
    prep_time: null,
    cook_time: null,
    servings: null,
  };
}

function basicExtraction($: cheerio.CheerioAPI, url: string): ScrapedRecipe {
  // Last resort: basic extraction
  const title = $('h1').first().text().trim() || $('title').text().trim() || 'Untitled Recipe';
  const description = $('meta[name="description"]').attr('content') || null;

  // Try to find any list that might be ingredients
  const lists = $('ul li, ol li');
  const possibleIngredients: string[] = [];
  const possibleInstructions: string[] = [];

  lists.each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 2 && text.length < 200) {
      // Simple heuristic: shorter items are likely ingredients
      if (text.length < 80) {
        possibleIngredients.push(text);
      } else {
        possibleInstructions.push(text);
      }
    }
  });

  // Get first significant image
  let imageUrl: string | null = null;
  $('img').each((_, el) => {
    if (imageUrl) return;
    const src = $(el).attr('src') || $(el).attr('data-src');
    const width = parseInt($(el).attr('width') || '0');
    if (src && (width > 200 || !$(el).attr('width'))) {
      imageUrl = src.startsWith('http') ? src : new URL(src, url).href;
    }
  });

  return {
    title,
    description,
    image_url: imageUrl,
    ingredients: possibleIngredients.slice(0, 30),
    instructions: possibleInstructions.slice(0, 20),
    prep_time: null,
    cook_time: null,
    servings: null,
  };
}

function extractImage(image: unknown): string | null {
  if (!image) return null;
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) return extractImage(image[0]);
  if (typeof image === 'object' && image !== null) {
    const img = image as Record<string, unknown>;
    return (img.url as string) || (img['@id'] as string) || null;
  }
  return null;
}

function extractIngredients(ingredients: unknown): string[] {
  if (!ingredients) return [];
  if (Array.isArray(ingredients)) {
    return ingredients.map((i) => (typeof i === 'string' ? i : String(i))).filter(Boolean);
  }
  return [];
}

function extractInstructions(instructions: unknown): string[] {
  if (!instructions) return [];
  if (typeof instructions === 'string') {
    return instructions.split(/\n+/).filter((s) => s.trim());
  }
  if (Array.isArray(instructions)) {
    return instructions.map((i) => {
      if (typeof i === 'string') return i;
      if (typeof i === 'object' && i !== null) {
        const inst = i as Record<string, unknown>;
        return (inst.text as string) || (inst.name as string) || '';
      }
      return '';
    }).filter(Boolean);
  }
  return [];
}

function parseDuration(duration: unknown): number | null {
  if (!duration || typeof duration !== 'string') return null;

  // Parse ISO 8601 duration (e.g., "PT30M", "PT1H30M")
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (match) {
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    return hours * 60 + minutes;
  }

  // Try simple number
  const num = parseInt(duration);
  return isNaN(num) ? null : num;
}

function parseServings(yield_: unknown): number | null {
  if (!yield_) return null;
  if (typeof yield_ === 'number') return yield_;
  if (typeof yield_ === 'string') {
    const match = yield_.match(/\d+/);
    return match ? parseInt(match[0]) : null;
  }
  if (Array.isArray(yield_)) {
    return parseServings(yield_[0]);
  }
  return null;
}
