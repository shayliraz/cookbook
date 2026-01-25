# Cookbook - Your Personal Cooking Journal

A fun, easy-to-use app to save recipes, track your cooking adventures, and remember what worked!

## Features

- **Save Recipes from URL**: Paste any recipe URL and the app automatically extracts ingredients and instructions
- **Cooking Log**: Track when you cooked each dish, rate it, add notes about changes you made
- **Photo Gallery**: Upload photos of your culinary creations
- **"What to Cook?" Helper**: Get suggestions based on time, favorites, or recipes you haven't made in a while
- **Smart Filters**: Search by ingredients, cuisine, tags, or rating
- **PWA**: Install on your phone for quick access
- **Push Notifications**: Get reminded about your favorite recipes
- **Share Recipes**: Share your cooking journal entries with friends

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **State Management**: Zustand with localStorage persistence
- **Icons**: Lucide React
- **Database (optional)**: Supabase (PostgreSQL)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/cookbook.git
cd cookbook
```

2. Install dependencies:
```bash
npm install
```

3. (Optional) Set up Supabase:
   - Create a free account at [supabase.com](https://supabase.com)
   - Create a new project
   - Run the SQL from `supabase-schema.sql` in the SQL editor
   - Copy your project URL and anon key to `.env.local`:
```bash
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

### Generate App Icons

To generate proper PWA icons:
```bash
npm install canvas
node scripts/generate-icons.js
```

## Deployment

### Netlify (Recommended - Free)

1. Push your code to GitHub
2. Connect your repo to Netlify
3. Netlify will auto-detect Next.js and deploy

Or use the CLI:
```bash
npm install -g netlify-cli
netlify deploy --prod
```

### Vercel

```bash
npm install -g vercel
vercel
```

## Future Features (Roadmap)

- [ ] Find similar recipes based on ingredients
- [ ] AI-powered recipe suggestions matching your taste
- [ ] "What can I cook with these ingredients?"
- [ ] Meal planning calendar
- [ ] Shopping list generator
- [ ] Recipe import from Instagram/TikTok
- [ ] Family/group recipe sharing
- [ ] Nutritional information

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this for your own cooking adventures!
