import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { ScrapedRecipe } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Fetch the page with multiple user agents as fallback
    const html = await fetchWithRetry(url);
    if (!html) {
      return NextResponse.json({ error: 'Failed to fetch URL' }, { status: 400 });
    }

    const $ = cheerio.load(html);
    const baseUrl = new URL(url).origin;

    // Try extraction methods in order of reliability
    let recipe = tryParseJsonLd($, baseUrl);

    if (!recipe || recipe.confidence === 'low') {
      const microdataRecipe = tryParseMicrodata($, baseUrl);
      if (microdataRecipe && (!recipe || microdataRecipe.confidence !== 'low')) {
        recipe = microdataRecipe;
      }
    }

    if (!recipe || recipe.confidence === 'low') {
      const siteSpecific = trySiteSpecificParsing($, url, baseUrl);
      if (siteSpecific && (!recipe || siteSpecific.confidence !== 'low')) {
        recipe = siteSpecific;
      }
    }

    if (!recipe) {
      recipe = smartFallbackExtraction($, url, baseUrl);
    }

    // Clean up the recipe data
    recipe = cleanupRecipe(recipe, $);

    return NextResponse.json(recipe);
  } catch (error) {
    console.error('Scraping error:', error);
    return NextResponse.json(
      { error: 'Failed to scrape recipe' },
      { status: 500 }
    );
  }
}

async function fetchWithRetry(url: string): Promise<string | null> {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  ];

  for (const userAgent of userAgents) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
          'Cache-Control': 'no-cache',
        },
      });

      if (response.ok) {
        return await response.text();
      }
    } catch (e) {
      console.error(`Fetch failed with user agent: ${userAgent}`, e);
    }
  }
  return null;
}

// ============================================
// JSON-LD Parsing (Most Reliable)
// ============================================
function tryParseJsonLd($: cheerio.CheerioAPI, baseUrl: string): ScrapedRecipe | null {
  try {
    const scripts = $('script[type="application/ld+json"]');

    for (let i = 0; i < scripts.length; i++) {
      const content = $(scripts[i]).html();
      if (!content) continue;

      try {
        const data = JSON.parse(content.replace(/[\r\n\t]/g, ' '));
        const recipeData = findRecipeInJsonLd(data);

        if (recipeData) {
          return parseJsonLdRecipe(recipeData, baseUrl);
        }
      } catch {
        // Try to fix common JSON issues
        try {
          const fixedContent = content
            .replace(/[\r\n\t]/g, ' ')
            .replace(/,\s*}/g, '}')
            .replace(/,\s*]/g, ']');
          const data = JSON.parse(fixedContent);
          const recipeData = findRecipeInJsonLd(data);
          if (recipeData) {
            return parseJsonLdRecipe(recipeData, baseUrl);
          }
        } catch {
          // Continue to next script
        }
      }
    }
  } catch (e) {
    console.error('JSON-LD parsing error:', e);
  }
  return null;
}

function findRecipeInJsonLd(data: unknown): Record<string, unknown> | null {
  if (!data) return null;

  // Direct Recipe object
  if (isRecipeType(data)) {
    return data as Record<string, unknown>;
  }

  // Array of objects
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeInJsonLd(item);
      if (found) return found;
    }
  }

  // Object with @graph
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;

    if (obj['@graph'] && Array.isArray(obj['@graph'])) {
      for (const item of obj['@graph']) {
        const found = findRecipeInJsonLd(item);
        if (found) return found;
      }
    }

    // Check nested properties
    for (const key of ['mainEntity', 'recipe', 'itemListElement']) {
      if (obj[key]) {
        const found = findRecipeInJsonLd(obj[key]);
        if (found) return found;
      }
    }
  }

  return null;
}

function isRecipeType(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  const type = obj['@type'];

  if (typeof type === 'string') {
    return type === 'Recipe' || type.toLowerCase().includes('recipe');
  }
  if (Array.isArray(type)) {
    return type.some(t => typeof t === 'string' && (t === 'Recipe' || t.toLowerCase().includes('recipe')));
  }
  return false;
}

function parseJsonLdRecipe(data: Record<string, unknown>, baseUrl: string): ScrapedRecipe {
  const publisher = data.publisher as Record<string, unknown> | undefined;
  return {
    title: extractString(data.name) || extractString(data.headline) || 'Untitled Recipe',
    description: extractString(data.description),
    image_url: extractImageUrl(data.image, baseUrl),
    ingredients: extractIngredientList(data.recipeIngredient),
    instructions: extractInstructionList(data.recipeInstructions),
    prep_time: parseDuration(data.prepTime),
    cook_time: parseDuration(data.cookTime),
    total_time: parseDuration(data.totalTime),
    servings: parseServings(data.recipeYield),
    cuisine: extractString(data.recipeCuisine),
    category: extractStringOrFirst(data.recipeCategory),
    tags: extractTags(data.keywords),
    author: extractAuthor(data.author),
    source_name: (publisher ? extractString(publisher.name) : null) || null,
    nutrition: extractNutrition(data.nutrition),
    confidence: 'high',
  };
}

// ============================================
// Microdata Parsing
// ============================================
function tryParseMicrodata($: cheerio.CheerioAPI, baseUrl: string): ScrapedRecipe | null {
  const recipeElement = $('[itemtype*="schema.org/Recipe"], [itemtype*="Recipe"]').first();
  if (!recipeElement.length) return null;

  const getItemprop = (prop: string): string | null => {
    const el = recipeElement.find(`[itemprop="${prop}"]`).first();
    return el.attr('content') || el.text().trim() || null;
  };

  const getAllItemprop = (prop: string): string[] => {
    const results: string[] = [];
    recipeElement.find(`[itemprop="${prop}"]`).each((_, el) => {
      const text = $(el).attr('content') || $(el).text().trim();
      if (text) results.push(text);
    });
    return results;
  };

  const title = getItemprop('name');
  if (!title) return null;

  const imageEl = recipeElement.find('[itemprop="image"]').first();
  let imageUrl = imageEl.attr('src') || imageEl.attr('content') || imageEl.attr('href');
  if (imageUrl && !imageUrl.startsWith('http')) {
    imageUrl = new URL(imageUrl, baseUrl).href;
  }

  return {
    title,
    description: getItemprop('description'),
    image_url: imageUrl || null,
    ingredients: getAllItemprop('recipeIngredient').length > 0
      ? getAllItemprop('recipeIngredient')
      : getAllItemprop('ingredients'),
    instructions: extractMicrodataInstructions($, recipeElement),
    prep_time: parseDuration(getItemprop('prepTime')),
    cook_time: parseDuration(getItemprop('cookTime')),
    total_time: parseDuration(getItemprop('totalTime')),
    servings: parseServings(getItemprop('recipeYield')),
    cuisine: getItemprop('recipeCuisine'),
    category: getItemprop('recipeCategory'),
    tags: [],
    author: getItemprop('author'),
    source_name: null,
    nutrition: null,
    confidence: 'high',
  };
}

function extractMicrodataInstructions($: cheerio.CheerioAPI, recipeElement: cheerio.Cheerio<any>): string[] {
  const instructions: string[] = [];

  // Try HowToStep
  recipeElement.find('[itemprop="recipeInstructions"] [itemprop="text"], [itemprop="recipeInstructions"] [itemtype*="HowToStep"]').each((_, el) => {
    const text = $(el).attr('content') || $(el).text().trim();
    if (text) instructions.push(text);
  });

  if (instructions.length > 0) return instructions;

  // Fallback to direct text
  recipeElement.find('[itemprop="recipeInstructions"]').each((_, el) => {
    const text = $(el).text().trim();
    if (text) {
      // Split by newlines or numbered steps
      const steps = text.split(/(?:\r?\n)+|(?:\d+\.\s+)/).filter(s => s.trim().length > 10);
      instructions.push(...steps);
    }
  });

  return instructions;
}

// ============================================
// Site-Specific Parsing
// ============================================
function trySiteSpecificParsing($: cheerio.CheerioAPI, url: string, baseUrl: string): ScrapedRecipe | null {
  const hostname = new URL(url).hostname.toLowerCase();

  // Define site-specific extractors
  const siteExtractors: Record<string, () => ScrapedRecipe | null> = {
    // AllRecipes
    'allrecipes.com': () => extractAllRecipes($, baseUrl),

    // BBC Good Food
    'bbcgoodfood.com': () => extractBBCGoodFood($, baseUrl),

    // Food Network
    'foodnetwork.com': () => extractFoodNetwork($, baseUrl),

    // Serious Eats
    'seriouseats.com': () => extractSeriousEats($, baseUrl),

    // Epicurious
    'epicurious.com': () => extractEpicurious($, baseUrl),

    // WordPress Recipe Maker (WPRM) - used by many sites
    'default_wprm': () => extractWPRM($, baseUrl),

    // Tasty
    'tasty.co': () => extractTasty($, baseUrl),

    // Hebrew sites
    'foodish.co.il': () => extractFoodish($, baseUrl),
    'foody.co.il': () => extractFoody($, baseUrl),
    'hashulchan.co.il': () => extractHashulchan($, baseUrl),
  };

  // Try exact match
  for (const [site, extractor] of Object.entries(siteExtractors)) {
    if (hostname.includes(site)) {
      const result = extractor();
      if (result && result.ingredients.length > 0) {
        return result;
      }
    }
  }

  // Try WPRM (WordPress Recipe Maker) - many sites use this
  if ($('.wprm-recipe').length > 0) {
    const result = siteExtractors['default_wprm']();
    if (result && result.ingredients.length > 0) {
      return result;
    }
  }

  // Try Tasty Recipes (another common WordPress plugin)
  if ($('.tasty-recipes').length > 0) {
    return extractTastyRecipesPlugin($, baseUrl);
  }

  // Try Recipe Card Blocks
  if ($('.recipe-card').length > 0 || $('.recipe-card-block').length > 0) {
    return extractRecipeCardBlock($, baseUrl);
  }

  return null;
}

function extractAllRecipes($: cheerio.CheerioAPI, baseUrl: string): ScrapedRecipe | null {
  const title = $('h1.article-heading').text().trim() || $('h1').first().text().trim();
  if (!title) return null;

  const ingredients: string[] = [];
  $('.mntl-structured-ingredients__list-item').each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text) ingredients.push(text);
  });

  const instructions: string[] = [];
  $('.mntl-sc-block-group--LI p').each((_, el) => {
    const text = $(el).text().trim();
    if (text) instructions.push(text);
  });

  return {
    title,
    description: $('meta[name="description"]').attr('content') || null,
    image_url: extractBestImage($, baseUrl),
    ingredients,
    instructions,
    prep_time: parseTimeFromText($('.mntl-recipe-details__label:contains("Prep Time")').next().text()),
    cook_time: parseTimeFromText($('.mntl-recipe-details__label:contains("Cook Time")').next().text()),
    total_time: parseTimeFromText($('.mntl-recipe-details__label:contains("Total Time")').next().text()),
    servings: parseServings($('.mntl-recipe-details__label:contains("Servings")').next().text()),
    cuisine: null,
    category: null,
    tags: [],
    author: $('.mntl-attribution__item-name').first().text().trim() || null,
    source_name: 'AllRecipes',
    nutrition: null,
    confidence: 'high',
  };
}

function extractBBCGoodFood($: cheerio.CheerioAPI, baseUrl: string): ScrapedRecipe | null {
  const title = $('h1.heading-1').text().trim();
  if (!title) return null;

  const ingredients: string[] = [];
  $('.recipe__ingredients li').each((_, el) => {
    ingredients.push($(el).text().trim());
  });

  const instructions: string[] = [];
  $('.recipe__method-steps li').each((_, el) => {
    const text = $(el).find('p').text().trim() || $(el).text().trim();
    if (text) instructions.push(text);
  });

  return {
    title,
    description: $('.recipe__description').text().trim() || null,
    image_url: extractBestImage($, baseUrl),
    ingredients,
    instructions,
    prep_time: parseTimeFromText($('.recipe__cook-and-prep li:contains("Prep")').text()),
    cook_time: parseTimeFromText($('.recipe__cook-and-prep li:contains("Cook")').text()),
    total_time: null,
    servings: parseServings($('.recipe__cook-and-prep li:contains("Serves")').text()),
    cuisine: null,
    category: null,
    tags: [],
    author: $('.author-link').text().trim() || null,
    source_name: 'BBC Good Food',
    nutrition: null,
    confidence: 'high',
  };
}

function extractFoodNetwork($: cheerio.CheerioAPI, baseUrl: string): ScrapedRecipe | null {
  const title = $('h1.o-AssetTitle__a-HeadlineText').text().trim() || $('h1').first().text().trim();
  if (!title) return null;

  const ingredients: string[] = [];
  $('.o-Ingredients__a-Ingredient').each((_, el) => {
    ingredients.push($(el).text().trim());
  });

  const instructions: string[] = [];
  $('.o-Method__m-Step').each((_, el) => {
    instructions.push($(el).text().trim());
  });

  return {
    title,
    description: $('meta[name="description"]').attr('content') || null,
    image_url: extractBestImage($, baseUrl),
    ingredients,
    instructions,
    prep_time: null,
    cook_time: null,
    total_time: parseTimeFromText($('.o-RecipeInfo__m-Time').text()),
    servings: parseServings($('.o-RecipeInfo__m-Yield').text()),
    cuisine: null,
    category: null,
    tags: [],
    author: $('.o-Attribution__a-Name').first().text().trim() || null,
    source_name: 'Food Network',
    nutrition: null,
    confidence: 'high',
  };
}

function extractSeriousEats($: cheerio.CheerioAPI, baseUrl: string): ScrapedRecipe | null {
  const title = $('h1.heading__title').text().trim() || $('h1').first().text().trim();
  if (!title) return null;

  const ingredients: string[] = [];
  $('.structured-ingredients__list-item').each((_, el) => {
    ingredients.push($(el).text().trim().replace(/\s+/g, ' '));
  });

  const instructions: string[] = [];
  $('.mntl-sc-block-group--LI p, .structured-project__steps li p').each((_, el) => {
    const text = $(el).text().trim();
    if (text) instructions.push(text);
  });

  return {
    title,
    description: $('meta[name="description"]').attr('content') || null,
    image_url: extractBestImage($, baseUrl),
    ingredients,
    instructions,
    prep_time: null,
    cook_time: null,
    total_time: parseTimeFromText($('.meta-text__data:contains("min")').text()),
    servings: parseServings($('.meta-text__data:contains("Serving")').text()),
    cuisine: null,
    category: null,
    tags: [],
    author: $('.mntl-attribution__item-name').first().text().trim() || null,
    source_name: 'Serious Eats',
    nutrition: null,
    confidence: 'high',
  };
}

function extractEpicurious($: cheerio.CheerioAPI, baseUrl: string): ScrapedRecipe | null {
  const title = $('h1[data-testid="ContentHeaderHed"]').text().trim() || $('h1').first().text().trim();
  if (!title) return null;

  const ingredients: string[] = [];
  $('[data-testid="IngredientList"] p').each((_, el) => {
    ingredients.push($(el).text().trim());
  });

  const instructions: string[] = [];
  $('[data-testid="InstructionsWrapper"] p').each((_, el) => {
    const text = $(el).text().trim();
    if (text) instructions.push(text);
  });

  return {
    title,
    description: $('meta[name="description"]').attr('content') || null,
    image_url: extractBestImage($, baseUrl),
    ingredients,
    instructions,
    prep_time: null,
    cook_time: null,
    total_time: null,
    servings: parseServings($('[data-testid="ServingsToggle"]').text()),
    cuisine: null,
    category: null,
    tags: [],
    author: $('[data-testid="BylineName"]').text().trim() || null,
    source_name: 'Epicurious',
    nutrition: null,
    confidence: 'high',
  };
}

function extractWPRM($: cheerio.CheerioAPI, baseUrl: string): ScrapedRecipe | null {
  const container = $('.wprm-recipe').first();
  if (!container.length) return null;

  const title = container.find('.wprm-recipe-name').text().trim();
  if (!title) return null;

  const ingredients: string[] = [];
  container.find('.wprm-recipe-ingredient').each((_, el) => {
    const amount = $(el).find('.wprm-recipe-ingredient-amount').text().trim();
    const unit = $(el).find('.wprm-recipe-ingredient-unit').text().trim();
    const name = $(el).find('.wprm-recipe-ingredient-name').text().trim();
    const notes = $(el).find('.wprm-recipe-ingredient-notes').text().trim();

    let ingredient = [amount, unit, name].filter(Boolean).join(' ');
    if (notes) ingredient += ` (${notes})`;
    if (ingredient) ingredients.push(ingredient);
  });

  const instructions: string[] = [];
  container.find('.wprm-recipe-instruction').each((_, el) => {
    const text = $(el).find('.wprm-recipe-instruction-text').text().trim() || $(el).text().trim();
    if (text) instructions.push(text);
  });

  return {
    title,
    description: container.find('.wprm-recipe-summary').text().trim() || null,
    image_url: container.find('.wprm-recipe-image img').attr('src') || extractBestImage($, baseUrl),
    ingredients,
    instructions,
    prep_time: parseTimeFromText(container.find('.wprm-recipe-prep-time-container').text()),
    cook_time: parseTimeFromText(container.find('.wprm-recipe-cook-time-container').text()),
    total_time: parseTimeFromText(container.find('.wprm-recipe-total-time-container').text()),
    servings: parseServings(container.find('.wprm-recipe-servings').text()),
    cuisine: container.find('.wprm-recipe-cuisine').text().trim() || null,
    category: container.find('.wprm-recipe-course').text().trim() || null,
    tags: [],
    author: container.find('.wprm-recipe-author').text().trim() || null,
    source_name: null,
    nutrition: extractWPRMNutrition(container, $),
    confidence: 'high',
  };
}

function extractWPRMNutrition(container: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): ScrapedRecipe['nutrition'] {
  const calories = container.find('.wprm-nutrition-label-text-nutrition-value-calories').text().trim();
  if (!calories) return null;

  return {
    calories: calories + ' kcal',
    protein: container.find('.wprm-nutrition-label-text-nutrition-value-protein').text().trim() || undefined,
    carbs: container.find('.wprm-nutrition-label-text-nutrition-value-carbohydrates').text().trim() || undefined,
    fat: container.find('.wprm-nutrition-label-text-nutrition-value-fat').text().trim() || undefined,
  };
}

function extractTasty($: cheerio.CheerioAPI, baseUrl: string): ScrapedRecipe | null {
  const title = $('h1').first().text().trim();
  if (!title) return null;

  const ingredients: string[] = [];
  $('.ingredients__section li').each((_, el) => {
    ingredients.push($(el).text().trim());
  });

  const instructions: string[] = [];
  $('.preparation__step').each((_, el) => {
    instructions.push($(el).text().trim());
  });

  return {
    title,
    description: $('meta[name="description"]').attr('content') || null,
    image_url: extractBestImage($, baseUrl),
    ingredients,
    instructions,
    prep_time: null,
    cook_time: null,
    total_time: null,
    servings: null,
    cuisine: null,
    category: null,
    tags: [],
    author: null,
    source_name: 'Tasty',
    nutrition: null,
    confidence: 'medium',
  };
}

function extractTastyRecipesPlugin($: cheerio.CheerioAPI, baseUrl: string): ScrapedRecipe | null {
  const container = $('.tasty-recipes').first();
  const title = container.find('.tasty-recipes-title').text().trim();
  if (!title) return null;

  const ingredients: string[] = [];
  container.find('.tasty-recipes-ingredients li').each((_, el) => {
    ingredients.push($(el).text().trim());
  });

  const instructions: string[] = [];
  container.find('.tasty-recipes-instructions li').each((_, el) => {
    instructions.push($(el).text().trim());
  });

  return {
    title,
    description: container.find('.tasty-recipes-description').text().trim() || null,
    image_url: container.find('.tasty-recipes-image img').attr('src') || extractBestImage($, baseUrl),
    ingredients,
    instructions,
    prep_time: parseTimeFromText(container.find('.tasty-recipes-prep-time').text()),
    cook_time: parseTimeFromText(container.find('.tasty-recipes-cook-time').text()),
    total_time: parseTimeFromText(container.find('.tasty-recipes-total-time').text()),
    servings: parseServings(container.find('.tasty-recipes-yield').text()),
    cuisine: null,
    category: null,
    tags: [],
    author: container.find('.tasty-recipes-author-name').text().trim() || null,
    source_name: null,
    nutrition: null,
    confidence: 'high',
  };
}

function extractRecipeCardBlock($: cheerio.CheerioAPI, baseUrl: string): ScrapedRecipe | null {
  const container = $('.recipe-card, .recipe-card-block').first();
  const title = container.find('h2, h3, .recipe-title').first().text().trim();
  if (!title) return null;

  const ingredients: string[] = [];
  container.find('.recipe-ingredients li, .ingredients li').each((_, el) => {
    ingredients.push($(el).text().trim());
  });

  const instructions: string[] = [];
  container.find('.recipe-instructions li, .instructions li, .directions li').each((_, el) => {
    instructions.push($(el).text().trim());
  });

  return {
    title,
    description: null,
    image_url: container.find('img').first().attr('src') || extractBestImage($, baseUrl),
    ingredients,
    instructions,
    prep_time: null,
    cook_time: null,
    total_time: null,
    servings: null,
    cuisine: null,
    category: null,
    tags: [],
    author: null,
    source_name: null,
    nutrition: null,
    confidence: 'medium',
  };
}

// Hebrew site extractors
function extractFoodish($: cheerio.CheerioAPI, baseUrl: string): ScrapedRecipe | null {
  const title = $('h1.entry-title').text().trim();
  if (!title) return null;

  const ingredients: string[] = [];
  $('.recipe-ingredients li, .ingredients li').each((_, el) => {
    ingredients.push($(el).text().trim());
  });

  const instructions: string[] = [];
  $('.recipe-directions li, .directions li, .instructions li').each((_, el) => {
    instructions.push($(el).text().trim());
  });

  return {
    title,
    description: $('meta[name="description"]').attr('content') || null,
    image_url: extractBestImage($, baseUrl),
    ingredients,
    instructions,
    prep_time: null,
    cook_time: null,
    total_time: null,
    servings: null,
    cuisine: 'Israeli',
    category: null,
    tags: [],
    author: null,
    source_name: 'Foodish',
    nutrition: null,
    confidence: 'medium',
  };
}

function extractFoody($: cheerio.CheerioAPI, baseUrl: string): ScrapedRecipe | null {
  const title = $('h1').first().text().trim();
  if (!title) return null;

  const ingredients: string[] = [];
  $('.recipe-ingredients li').each((_, el) => {
    ingredients.push($(el).text().trim());
  });

  const instructions: string[] = [];
  $('.recipe-instructions p, .recipe-directions li').each((_, el) => {
    const text = $(el).text().trim();
    if (text) instructions.push(text);
  });

  return {
    title,
    description: null,
    image_url: extractBestImage($, baseUrl),
    ingredients,
    instructions,
    prep_time: null,
    cook_time: null,
    total_time: null,
    servings: null,
    cuisine: 'Israeli',
    category: null,
    tags: [],
    author: null,
    source_name: 'Foody',
    nutrition: null,
    confidence: 'medium',
  };
}

function extractHashulchan($: cheerio.CheerioAPI, baseUrl: string): ScrapedRecipe | null {
  const title = $('h1.entry-title, h1').first().text().trim();
  if (!title) return null;

  const ingredients: string[] = [];
  $('.ingredients li, .recipe-ingredients li').each((_, el) => {
    ingredients.push($(el).text().trim());
  });

  const instructions: string[] = [];
  $('.instructions li, .recipe-instructions li, .directions li').each((_, el) => {
    instructions.push($(el).text().trim());
  });

  return {
    title,
    description: null,
    image_url: extractBestImage($, baseUrl),
    ingredients,
    instructions,
    prep_time: null,
    cook_time: null,
    total_time: null,
    servings: null,
    cuisine: 'Israeli',
    category: null,
    tags: [],
    author: null,
    source_name: 'השולחן',
    nutrition: null,
    confidence: 'medium',
  };
}

// ============================================
// Smart Fallback Extraction
// ============================================
function smartFallbackExtraction($: cheerio.CheerioAPI, url: string, baseUrl: string): ScrapedRecipe {
  // Remove noisy elements that are definitely not recipe content
  removeNoiseElements($);

  // Try multiple title patterns
  const title = findTitle($);
  const description = $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') ||
    null;

  // Smart ingredient detection
  const ingredients = findIngredients($);

  // Smart instruction detection
  const instructions = findInstructions($);

  return {
    title,
    description,
    image_url: extractBestImage($, baseUrl),
    ingredients,
    instructions,
    prep_time: findTimeInPage($, ['prep', 'הכנה']),
    cook_time: findTimeInPage($, ['cook', 'בישול']),
    total_time: findTimeInPage($, ['total', 'סה"כ', 'זמן הכנה']),
    servings: findServingsInPage($),
    cuisine: null,
    category: null,
    tags: [],
    author: findAuthor($),
    source_name: extractSiteName($, url),
    nutrition: null,
    confidence: ingredients.length > 2 && instructions.length > 1 ? 'medium' : 'low',
  };
}

/**
 * Remove elements that are clearly not recipe content
 */
function removeNoiseElements($: cheerio.CheerioAPI): void {
  // Common noise selectors - comments, ads, social, navigation, etc.
  const noiseSelectors = [
    // Comments
    '#comments', '.comments', '.comment-section', '.comment-list',
    '#respond', '.respond', '#reply', '.replies',
    '.talkback', '.talkbacks', '#talkback', '.comment-form',
    '.fb-comments', '.disqus', '#disqus_thread',
    // Hebrew comment patterns
    '.תגובות', '#תגובות', '.טוקבק', '.טוקבקים',
    // Social/sharing
    '.social-share', '.share-buttons', '.sharing', '.social-buttons',
    '.addthis', '.sharethis',
    // Ads
    '.advertisement', '.ad-container', '.ads', '.ad-wrapper',
    '[class*="advert"]', '[id*="advert"]',
    // Navigation
    'nav', '.navigation', '.nav-menu', '.breadcrumb', '.breadcrumbs',
    // Related content
    '.related-posts', '.related-recipes', '.also-like', '.you-may-like',
    '.recommended', '.suggestions',
    // Sidebar
    'aside', '.sidebar', '#sidebar', '.widget-area',
    // Footer
    'footer', '.footer', '#footer', '.site-footer',
    // Newsletter
    '.newsletter', '.subscribe-form', '.email-signup',
    // Author bio (not the author name, but long bio sections)
    '.author-bio', '.author-box', '.about-author',
    // Ratings/reviews from users
    '.user-reviews', '.user-ratings', '.reviews-section',
    // Print/utility buttons
    '.print-button', '.utility-buttons',
  ];

  noiseSelectors.forEach(selector => {
    $(selector).remove();
  });
}

function findTitle($: cheerio.CheerioAPI): string {
  const titleSelectors = [
    'h1.recipe-title',
    'h1.entry-title',
    'h1[itemprop="name"]',
    '.recipe-name',
    'h1',
    'meta[property="og:title"]',
  ];

  for (const selector of titleSelectors) {
    const el = $(selector).first();
    const text = selector.includes('meta') ? el.attr('content') : el.text();
    if (text?.trim()) {
      return text.trim().replace(/\s+/g, ' ');
    }
  }

  return $('title').text().trim().split(/[|\-–—]/)[0].trim() || 'Untitled Recipe';
}

function findIngredients($: cheerio.CheerioAPI): string[] {
  const ingredients: string[] = [];

  // Common ingredient container patterns
  const containerSelectors = [
    '.recipe-ingredients',
    '.ingredients',
    '#ingredients',
    '[class*="ingredient"]',
    '.wprm-recipe-ingredients',
    '.tasty-recipes-ingredients',
    // Hebrew patterns
    '.מרכיבים',
    '.חומרים',
    '[class*="מרכיב"]',
    '[class*="חומר"]',
  ];

  for (const selector of containerSelectors) {
    const container = $(selector).first();
    if (container.length) {
      container.find('li').each((_, el) => {
        const text = cleanIngredientText($(el).text());
        if (text && isLikelyIngredient(text)) {
          ingredients.push(text);
        }
      });

      if (ingredients.length >= 3) return ingredients;
    }
  }

  // Fallback: look for lists near "ingredient" text (English and Hebrew)
  $('*:contains("ngredient"), *:contains("מרכיבים"), *:contains("חומרים")').each((_, el) => {
    const $el = $(el);
    const $list = $el.next('ul, ol').length ? $el.next('ul, ol') : $el.find('ul, ol').first();

    if ($list.length) {
      $list.find('li').each((_, li) => {
        const text = cleanIngredientText($(li).text());
        if (text && isLikelyIngredient(text)) {
          ingredients.push(text);
        }
      });
    }
  });

  // Additional fallback: look for any unordered list where most items look like ingredients
  if (ingredients.length < 3) {
    $('ul').each((_, ul) => {
      const $ul = $(ul);
      const items: string[] = [];
      let ingredientLikeCount = 0;

      $ul.find('li').each((_, li) => {
        const text = cleanIngredientText($(li).text());
        if (text) {
          items.push(text);
          if (isLikelyIngredient(text)) {
            ingredientLikeCount++;
          }
        }
      });

      // If more than 60% look like ingredients, use this list
      if (items.length >= 3 && ingredientLikeCount / items.length > 0.6) {
        items.forEach(item => {
          if (isLikelyIngredient(item) && !ingredients.includes(item)) {
            ingredients.push(item);
          }
        });
      }
    });
  }

  // Deduplicate and limit
  return [...new Set(ingredients)].slice(0, 50);
}

function findInstructions($: cheerio.CheerioAPI): string[] {
  const instructions: string[] = [];

  const containerSelectors = [
    '.recipe-instructions',
    '.instructions',
    '.directions',
    '#instructions',
    '.recipe-method',
    '.method',
    '[class*="instruction"]',
    '[class*="direction"]',
    '.wprm-recipe-instructions',
    '.tasty-recipes-instructions',
    // Hebrew patterns
    '.הוראות-הכנה',
    '.אופן-הכנה',
    '[class*="הכנה"]',
  ];

  for (const selector of containerSelectors) {
    const container = $(selector).first();
    if (container.length) {
      // Try list items first
      container.find('li').each((_, el) => {
        const text = cleanInstructionText($(el).text());
        if (text && isLikelyInstruction(text)) {
          instructions.push(text);
        }
      });

      // If no list items, try paragraphs
      if (instructions.length === 0) {
        container.find('p').each((_, el) => {
          const text = cleanInstructionText($(el).text());
          if (text && isLikelyInstruction(text)) {
            instructions.push(text);
          }
        });
      }

      if (instructions.length >= 2) return instructions;
    }
  }

  // Fallback: look for ordered lists with longer text that look like instructions
  $('ol li').each((_, el) => {
    const text = cleanInstructionText($(el).text());
    if (text && isLikelyInstruction(text) && instructions.length < 20) {
      instructions.push(text);
    }
  });

  // If still no instructions, try paragraphs near "instruction" or "method" text
  if (instructions.length === 0) {
    $('*:contains("nstruction"), *:contains("ethod"), *:contains("הכנה"), *:contains("הוראות")').each((_, el) => {
      const $el = $(el);
      // Look for nearby paragraphs or list
      const $content = $el.next('ol, ul, p').length ? $el.next('ol, ul, p') : $el.find('ol, ul, p').first();

      if ($content.is('ol, ul')) {
        $content.find('li').each((_, li) => {
          const text = cleanInstructionText($(li).text());
          if (text && isLikelyInstruction(text)) {
            instructions.push(text);
          }
        });
      } else if ($content.is('p')) {
        const text = cleanInstructionText($content.text());
        if (text && isLikelyInstruction(text)) {
          instructions.push(text);
        }
      }
    });
  }

  return [...new Set(instructions)];
}

function findTimeInPage($: cheerio.CheerioAPI, keywords: string[]): number | null {
  for (const keyword of keywords) {
    // Look for time near keyword
    const elements = $(`*:contains("${keyword}")`).toArray();
    for (const el of elements) {
      const text = $(el).text().toLowerCase();
      const timeMatch = text.match(/(\d+)\s*(min|minute|דקות|שעה|hour|hr)/i);
      if (timeMatch) {
        const value = parseInt(timeMatch[1]);
        const unit = timeMatch[2].toLowerCase();
        if (unit.includes('hour') || unit.includes('hr') || unit.includes('שעה')) {
          return value * 60;
        }
        return value;
      }
    }
  }
  return null;
}

function findServingsInPage($: cheerio.CheerioAPI): number | null {
  const servingsPatterns = [
    /serves?\s*:?\s*(\d+)/i,
    /(\d+)\s*servings?/i,
    /מנות\s*:?\s*(\d+)/i,
    /(\d+)\s*מנות/i,
    /yield\s*:?\s*(\d+)/i,
  ];

  const pageText = $('body').text();

  for (const pattern of servingsPatterns) {
    const match = pageText.match(pattern);
    if (match) {
      return parseInt(match[1]);
    }
  }

  return null;
}

function findAuthor($: cheerio.CheerioAPI): string | null {
  const authorSelectors = [
    '[rel="author"]',
    '.author-name',
    '.recipe-author',
    '[itemprop="author"]',
    '.by-author',
    '.entry-author',
  ];

  for (const selector of authorSelectors) {
    const text = $(selector).first().text().trim();
    if (text && text.length < 100) {
      return text.replace(/^by\s+/i, '');
    }
  }

  return null;
}

// ============================================
// Helper Functions
// ============================================
function extractString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value)) return extractString(value[0]);
  return null;
}

function extractStringOrFirst(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value) && value.length > 0) {
    return typeof value[0] === 'string' ? value[0].trim() : null;
  }
  return null;
}

function extractImageUrl(image: unknown, baseUrl: string): string | null {
  if (!image) return null;

  let url: string | null = null;

  if (typeof image === 'string') {
    url = image;
  } else if (Array.isArray(image)) {
    url = extractImageUrl(image[0], baseUrl);
  } else if (typeof image === 'object' && image !== null) {
    const img = image as Record<string, unknown>;
    url = (img.url as string) || (img.contentUrl as string) || (img['@id'] as string) || null;
  }

  if (url && !url.startsWith('http')) {
    url = new URL(url, baseUrl).href;
  }

  return url;
}

function extractBestImage($: cheerio.CheerioAPI, baseUrl: string): string | null {
  // Prefer Open Graph image
  const ogImage = $('meta[property="og:image"]').attr('content');
  if (ogImage) return ogImage.startsWith('http') ? ogImage : new URL(ogImage, baseUrl).href;

  // Look for recipe-specific images
  const recipeImageSelectors = [
    '.recipe-image img',
    '.recipe-photo img',
    '[itemprop="image"]',
    'article img',
    '.entry-content img',
    '.post-thumbnail img',
  ];

  for (const selector of recipeImageSelectors) {
    const img = $(selector).first();
    const src = img.attr('src') || img.attr('data-src') || img.attr('data-lazy-src');
    if (src && !src.includes('avatar') && !src.includes('logo')) {
      return src.startsWith('http') ? src : new URL(src, baseUrl).href;
    }
  }

  // Find largest image
  let bestImage: string | null = null;
  let maxSize = 0;

  $('img').each((_, el) => {
    const $img = $(el);
    const src = $img.attr('src') || $img.attr('data-src');
    if (!src || src.includes('avatar') || src.includes('logo') || src.includes('icon')) return;

    const width = parseInt($img.attr('width') || '0');
    const height = parseInt($img.attr('height') || '0');
    const size = width * height;

    if (size > maxSize || (!maxSize && src)) {
      maxSize = size;
      bestImage = src.startsWith('http') ? src : new URL(src, baseUrl).href;
    }
  });

  return bestImage;
}

function extractIngredientList(ingredients: unknown): string[] {
  if (!ingredients) return [];

  if (Array.isArray(ingredients)) {
    return ingredients.map(i => {
      if (typeof i === 'string') return cleanIngredientText(i);
      if (typeof i === 'object' && i !== null) {
        const ing = i as Record<string, unknown>;
        return cleanIngredientText(String(ing.text || ing.name || i));
      }
      return '';
    }).filter(Boolean);
  }

  if (typeof ingredients === 'string') {
    return ingredients.split(/[,\n]/).map(s => cleanIngredientText(s)).filter(Boolean);
  }

  return [];
}

function extractInstructionList(instructions: unknown): string[] {
  if (!instructions) return [];

  if (typeof instructions === 'string') {
    return instructions
      .split(/\n+|\r\n+/)
      .map(s => cleanInstructionText(s))
      .filter(s => s && s.length > 10);
  }

  if (Array.isArray(instructions)) {
    const result: string[] = [];

    for (const item of instructions) {
      if (typeof item === 'string') {
        const cleaned = cleanInstructionText(item);
        if (cleaned && cleaned.length > 10) result.push(cleaned);
      } else if (typeof item === 'object' && item !== null) {
        const inst = item as Record<string, unknown>;

        // Handle HowToStep
        if (inst['@type'] === 'HowToStep' || inst.text) {
          const text = cleanInstructionText(String(inst.text || inst.name || ''));
          if (text && text.length > 10) result.push(text);
        }
        // Handle HowToSection
        else if (inst['@type'] === 'HowToSection' && inst.itemListElement) {
          result.push(...extractInstructionList(inst.itemListElement));
        }
      }
    }

    return result;
  }

  return [];
}

function extractTags(keywords: unknown): string[] {
  if (!keywords) return [];

  if (typeof keywords === 'string') {
    return keywords.split(/[,;]/).map(s => s.trim()).filter(s => s && s.length < 30);
  }

  if (Array.isArray(keywords)) {
    return keywords.filter(k => typeof k === 'string' && k.length < 30);
  }

  return [];
}

function extractAuthor(author: unknown): string | null {
  if (!author) return null;
  if (typeof author === 'string') return author;
  if (Array.isArray(author)) return extractAuthor(author[0]);
  if (typeof author === 'object' && author !== null) {
    const auth = author as Record<string, unknown>;
    return extractString(auth.name) || null;
  }
  return null;
}

function extractNutrition(nutrition: unknown): ScrapedRecipe['nutrition'] {
  if (!nutrition || typeof nutrition !== 'object') return null;

  const n = nutrition as Record<string, unknown>;

  return {
    calories: extractString(n.calories) || undefined,
    protein: extractString(n.proteinContent) || undefined,
    carbs: extractString(n.carbohydrateContent) || undefined,
    fat: extractString(n.fatContent) || undefined,
  };
}

function extractSiteName($: cheerio.CheerioAPI, url: string): string | null {
  const ogSiteName = $('meta[property="og:site_name"]').attr('content');
  if (ogSiteName) return ogSiteName;

  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '').split('.')[0];
  } catch {
    return null;
  }
}

function cleanIngredientText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\n\r\t]/g, ' ')
    .trim();
}

function cleanInstructionText(text: string): string {
  return text
    .replace(/^\d+[\.\)]\s*/, '') // Remove leading step numbers
    .replace(/^step\s*\d*:?\s*/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[\n\r\t]/g, ' ')
    .trim();
}

function isLikelyIngredient(text: string): boolean {
  // Too short or too long
  if (text.length < 2 || text.length > 200) return false;

  // Blacklist patterns - things that are definitely NOT ingredients
  const blacklistPatterns = [
    // Comments/social patterns
    /reply|תגובה|השב|comment|like|share|שתף|follow|עקוב/i,
    /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/, // Dates
    /\d{1,2}:\d{2}/, // Times
    /@\w+/, // Mentions
    /https?:\/\//, // URLs
    /^\d+\s*(likes?|comments?|shares?|views?)/i,
    /ago|לפני|ימים|שעות|דקות/i, // "X time ago"
    /logged in|login|sign up|הרשמ|התחבר/i,
    /subscribe|newsletter|הרשם לניוזלטר/i,
    /advertisement|פרסומת|מודעה/i,
    /rating|דירוג|stars?|כוכבים/i,
    /print|הדפס|save|שמור/i,
    /facebook|twitter|instagram|pinterest|whatsapp/i,
    /copyright|©|כל הזכויות/i,
    /read more|קרא עוד|המשך/i,
    /related|קשור|דומה|גם יעניין/i,
    /author|מחבר|נכתב על ידי/i,
    /category|קטגוריה/i,
    /^\s*[\u0590-\u05FF\w]+\s+אמר/i, // "X said" pattern in Hebrew
    /wrote:|כתב:|said:/i,
  ];

  if (blacklistPatterns.some(p => p.test(text))) return false;

  // If text has multiple sentences, probably not an ingredient
  if ((text.match(/[.!?]/g) || []).length > 1) return false;

  // Contains common ingredient patterns (whitelist)
  const ingredientPatterns = [
    /\d+\s*(cup|tbsp|tsp|oz|g|kg|ml|l|lb|pound|tablespoon|teaspoon)/i,
    /\d+\/\d+/,
    /½|⅓|¼|⅔|¾|⅛/,
    /כף|כפית|כוס|גרם|ק"ג|מ"ל|ליטר|יחידות?|חבילה|שקית/,
    /\d+\s*(small|medium|large|קטנ|בינונ|גדול)/i,
    /pinch|dash|קמצוץ|מעט/i,
  ];

  // Has ingredient pattern = definitely an ingredient
  if (ingredientPatterns.some(p => p.test(text))) return true;

  // Short text with few words is likely an ingredient
  const wordCount = text.split(/\s+/).length;
  return wordCount <= 8 && !text.includes('?');
}

function isLikelyInstruction(text: string): boolean {
  // Too short
  if (text.length < 15) return false;

  // Blacklist patterns
  const blacklistPatterns = [
    /reply|תגובה|השב|comment/i,
    /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/, // Dates
    /@\w+/, // Mentions
    /https?:\/\//, // URLs
    /ago|לפני\s+\d+/i,
    /logged in|login|sign up|הרשמ|התחבר/i,
    /subscribe|newsletter/i,
    /advertisement|פרסומת/i,
    /facebook|twitter|instagram|pinterest/i,
    /copyright|©/i,
    /^\s*[\u0590-\u05FF\w]+\s+אמר/i, // "X said"
    /wrote:|כתב:|said:/i,
    /thank you|תודה|thanks/i,
    /great recipe|מתכון מעולה|delicious|טעים/i, // Comments about recipe
    /tried this|ניסיתי|made this|הכנתי/i,
    /question|שאלה|\?$/i,
  ];

  if (blacklistPatterns.some(p => p.test(text))) return false;

  // Contains cooking action verbs (whitelist hints)
  const cookingVerbs = [
    /mix|stir|bake|cook|fry|boil|simmer|chop|slice|dice|pour|add|combine|fold|whisk|beat|knead|roll|spread|season|marinate|preheat|heat|cool|chill|freeze|serve|garnish|drizzle|sprinkle/i,
    /ערבב|בחש|אפה|בשל|טגן|הרתח|קצץ|חתוך|פרוס|הוסף|שפוך|מזג|לש|רדד|מרח|תיבל|חמם|צנן|קרר|הגש|קשט|זלף|פזר/,
  ];

  // If has cooking verbs, more likely to be instruction
  return cookingVerbs.some(p => p.test(text)) || text.length > 30;
}

function parseDuration(duration: unknown): number | null {
  if (!duration) return null;
  if (typeof duration === 'number') return duration;
  if (typeof duration !== 'string') return null;

  // ISO 8601 duration
  const isoMatch = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (isoMatch) {
    const hours = parseInt(isoMatch[1] || '0');
    const minutes = parseInt(isoMatch[2] || '0');
    return hours * 60 + minutes;
  }

  // Text format: "1 hour 30 minutes" or "90 minutes"
  const textMatch = duration.match(/(?:(\d+)\s*(?:hour|hr|שעה)s?)?\s*(?:(\d+)\s*(?:min|minute|דקה|דקות)s?)?/i);
  if (textMatch && (textMatch[1] || textMatch[2])) {
    const hours = parseInt(textMatch[1] || '0');
    const minutes = parseInt(textMatch[2] || '0');
    return hours * 60 + minutes;
  }

  // Simple number
  const num = parseInt(duration);
  return isNaN(num) ? null : num;
}

function parseTimeFromText(text: string | undefined): number | null {
  if (!text) return null;
  return parseDuration(text);
}

function parseServings(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === 'number') return value;

  if (typeof value === 'string') {
    const match = value.match(/\d+/);
    return match ? parseInt(match[0]) : null;
  }

  if (Array.isArray(value)) {
    return parseServings(value[0]);
  }

  return null;
}

function cleanupRecipe(recipe: ScrapedRecipe, $: cheerio.CheerioAPI): ScrapedRecipe {
  // Decode HTML entities in all text fields
  recipe.title = decodeHtmlEntities(recipe.title);
  recipe.description = recipe.description ? decodeHtmlEntities(recipe.description) : null;
  recipe.ingredients = recipe.ingredients.map(decodeHtmlEntities).map(cleanFractions);
  recipe.instructions = recipe.instructions.map(decodeHtmlEntities);
  recipe.author = recipe.author ? decodeHtmlEntities(recipe.author) : null;
  recipe.cuisine = recipe.cuisine ? decodeHtmlEntities(recipe.cuisine) : null;
  recipe.category = recipe.category ? decodeHtmlEntities(recipe.category) : null;
  recipe.tags = recipe.tags.map(decodeHtmlEntities);

  // Remove duplicate ingredients/instructions
  recipe.ingredients = [...new Set(recipe.ingredients)].filter(Boolean);
  recipe.instructions = [...new Set(recipe.instructions)].filter(Boolean);

  // Try to extract cuisine from content if not found
  if (!recipe.cuisine) {
    const pageText = $('body').text().toLowerCase();
    const cuisines = [
      'italian', 'mexican', 'chinese', 'japanese', 'indian', 'thai', 'french',
      'mediterranean', 'greek', 'korean', 'vietnamese', 'american', 'israeli',
      'middle eastern', 'moroccan', 'spanish', 'german',
      'איטלקי', 'מקסיקני', 'סיני', 'יפני', 'הודי', 'תאילנדי', 'צרפתי', 'ישראלי',
    ];

    for (const cuisine of cuisines) {
      if (pageText.includes(cuisine)) {
        recipe.cuisine = cuisine.charAt(0).toUpperCase() + cuisine.slice(1);
        break;
      }
    }
  }

  // Calculate total time if not present
  if (!recipe.total_time && recipe.prep_time && recipe.cook_time) {
    recipe.total_time = recipe.prep_time + recipe.cook_time;
  }

  return recipe;
}

/**
 * Decode HTML entities like &#39; &amp; &quot; etc.
 */
function decodeHtmlEntities(text: string): string {
  if (!text) return text;

  // Decode numeric entities (&#39; &#x27; etc.)
  let decoded = text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));

  // Decode named entities
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&nbsp;': ' ',
    '&ndash;': '\u2013', // en-dash
    '&mdash;': '\u2014', // em-dash
    '&lsquo;': '\u2018', // left single quote
    '&rsquo;': '\u2019', // right single quote (apostrophe)
    '&ldquo;': '\u201C', // left double quote
    '&rdquo;': '\u201D', // right double quote
    '&hellip;': '\u2026', // ellipsis
    '&copy;': '\u00A9', // copyright
    '&reg;': '\u00AE', // registered
    '&trade;': '\u2122', // trademark
    '&deg;': '\u00B0', // degree
    '&frac12;': '\u00BD', // 1/2
    '&frac14;': '\u00BC', // 1/4
    '&frac34;': '\u00BE', // 3/4
  };

  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }

  return decoded;
}

/**
 * Clean up ugly decimal fractions into readable forms.
 * e.g. "0.33333334326744 cup" → "1/3 cup", "0.5 cup" → "1/2 cup"
 */
function cleanFractions(text: string): string {
  if (!text) return text;

  // Map of decimal values to their fraction representations
  const fractionMap: Array<{ min: number; max: number; display: string }> = [
    { min: 0.12, max: 0.13, display: '1/8' },
    { min: 0.24, max: 0.26, display: '1/4' },
    { min: 0.32, max: 0.35, display: '1/3' },
    { min: 0.37, max: 0.38, display: '3/8' },
    { min: 0.49, max: 0.51, display: '1/2' },
    { min: 0.62, max: 0.63, display: '5/8' },
    { min: 0.65, max: 0.68, display: '2/3' },
    { min: 0.74, max: 0.76, display: '3/4' },
    { min: 0.87, max: 0.88, display: '7/8' },
  ];

  // Replace long decimals (e.g., 0.33333334326744) with fractions
  return text.replace(/(\d+)\.(\d{2,})/g, (match, whole, decimal) => {
    const num = parseFloat(match);
    const wholeNum = Math.floor(num);
    const fractional = num - wholeNum;

    // Check if the fractional part matches a known fraction
    for (const frac of fractionMap) {
      if (fractional >= frac.min && fractional <= frac.max) {
        if (wholeNum === 0) {
          return frac.display;
        }
        return `${wholeNum} ${frac.display}`;
      }
    }

    // If no fraction match, just round to 2 decimal places
    const rounded = Math.round(num * 100) / 100;
    if (rounded === Math.floor(rounded)) {
      return Math.floor(rounded).toString();
    }
    return rounded.toString();
  });
}
