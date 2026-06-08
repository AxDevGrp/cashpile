export interface SystemCategoryRuleSeed {
  pattern: string;
  categoryName: string;
  priority: number;
}

export const SYSTEM_CATEGORY_RULES: SystemCategoryRuleSeed[] = [
  // AI tools + LLM subscriptions
  { pattern: "ANTHROPIC", categoryName: "Software & Subscriptions", priority: 100 },
  { pattern: "CLAUDE", categoryName: "Software & Subscriptions", priority: 100 },
  { pattern: "OPENROUTER", categoryName: "Software & Subscriptions", priority: 100 },
  { pattern: "OPENAI", categoryName: "Software & Subscriptions", priority: 100 },
  { pattern: "CHATGPT", categoryName: "Software & Subscriptions", priority: 100 },
  { pattern: "PERPLEXITY", categoryName: "Software & Subscriptions", priority: 95 },
  { pattern: "MIDJOURNEY", categoryName: "Software & Subscriptions", priority: 95 },
  { pattern: "RUNWAY", categoryName: "Software & Subscriptions", priority: 95 },
  { pattern: "ELEVENLABS", categoryName: "Software & Subscriptions", priority: 95 },
  { pattern: "REPLICATE", categoryName: "Software & Subscriptions", priority: 95 },
  { pattern: "HUGGING FACE", categoryName: "Software & Subscriptions", priority: 95 },

  // Developer tools + SaaS
  { pattern: "CURSOR", categoryName: "Software & Subscriptions", priority: 90 },
  { pattern: "GITHUB", categoryName: "Software & Subscriptions", priority: 90 },
  { pattern: "GITLAB", categoryName: "Software & Subscriptions", priority: 90 },
  { pattern: "REPLIT", categoryName: "Software & Subscriptions", priority: 90 },
  { pattern: "LINEAR", categoryName: "Software & Subscriptions", priority: 90 },
  { pattern: "NOTION", categoryName: "Software & Subscriptions", priority: 90 },
  { pattern: "SLACK", categoryName: "Software & Subscriptions", priority: 90 },
  { pattern: "FIGMA", categoryName: "Software & Subscriptions", priority: 90 },
  { pattern: "CANVA", categoryName: "Software & Subscriptions", priority: 85 },
  { pattern: "ADOBE", categoryName: "Software & Subscriptions", priority: 90 },
  { pattern: "MICROSOFT 365", categoryName: "Software & Subscriptions", priority: 90 },
  { pattern: "GOOGLE WORKSPACE", categoryName: "Software & Subscriptions", priority: 90 },
  { pattern: "DROPBOX", categoryName: "Software & Subscriptions", priority: 85 },
  { pattern: "ZOOM", categoryName: "Software & Subscriptions", priority: 85 },
  { pattern: "CALENDLY", categoryName: "Software & Subscriptions", priority: 85 },
  { pattern: "LOOM", categoryName: "Software & Subscriptions", priority: 85 },

  // Cloud + hosting + infrastructure
  { pattern: "VERCEL", categoryName: "Cloud & Hosting", priority: 95 },
  { pattern: "SUPABASE", categoryName: "Cloud & Hosting", priority: 95 },
  { pattern: "RAILWAY", categoryName: "Cloud & Hosting", priority: 95 },
  { pattern: "AWS", categoryName: "Cloud & Hosting", priority: 95 },
  { pattern: "AMAZON WEB SERVICES", categoryName: "Cloud & Hosting", priority: 95 },
  { pattern: "CLOUDFLARE", categoryName: "Cloud & Hosting", priority: 95 },
  { pattern: "DIGITALOCEAN", categoryName: "Cloud & Hosting", priority: 90 },
  { pattern: "HEROKU", categoryName: "Cloud & Hosting", priority: 90 },
  { pattern: "RENDER", categoryName: "Cloud & Hosting", priority: 85 },
  { pattern: "NAMECHEAP", categoryName: "Cloud & Hosting", priority: 85 },
  { pattern: "GODADDY", categoryName: "Cloud & Hosting", priority: 85 },

  // Streaming/media subscriptions
  { pattern: "NETFLIX", categoryName: "Entertainment", priority: 80 },
  { pattern: "SPOTIFY", categoryName: "Entertainment", priority: 80 },
  { pattern: "HULU", categoryName: "Entertainment", priority: 80 },
  { pattern: "DISNEY", categoryName: "Entertainment", priority: 80 },
  { pattern: "MAX", categoryName: "Entertainment", priority: 70 },
  { pattern: "HBO", categoryName: "Entertainment", priority: 80 },
  { pattern: "PARAMOUNT", categoryName: "Entertainment", priority: 75 },
  { pattern: "PEACOCK", categoryName: "Entertainment", priority: 75 },
  { pattern: "YOUTUBE PREMIUM", categoryName: "Entertainment", priority: 80 },
  { pattern: "APPLE MUSIC", categoryName: "Entertainment", priority: 80 },
  { pattern: "AUDIBLE", categoryName: "Entertainment", priority: 75 },
  { pattern: "KINDLE", categoryName: "Entertainment", priority: 70 },

  // Food delivery / dining
  { pattern: "DOORDASH", categoryName: "Meals & Dining", priority: 75 },
  { pattern: "UBER EATS", categoryName: "Meals & Dining", priority: 75 },
  { pattern: "GRUBHUB", categoryName: "Meals & Dining", priority: 75 },
  { pattern: "STARBUCKS", categoryName: "Meals & Dining", priority: 70 },
  { pattern: "CHIPOTLE", categoryName: "Meals & Dining", priority: 70 },
  { pattern: "MCDONALD", categoryName: "Meals & Dining", priority: 70 },

  // Groceries / stores
  { pattern: "WHOLE FOODS", categoryName: "Groceries", priority: 75 },
  { pattern: "TRADER JOE", categoryName: "Groceries", priority: 75 },
  { pattern: "KROGER", categoryName: "Groceries", priority: 70 },
  { pattern: "PUBLIX", categoryName: "Groceries", priority: 70 },
  { pattern: "SAFEWAY", categoryName: "Groceries", priority: 70 },
  { pattern: "ALDI", categoryName: "Groceries", priority: 70 },
  { pattern: "INSTACART", categoryName: "Groceries", priority: 70 },

  // Shopping
  { pattern: "AMAZON", categoryName: "Shopping", priority: 55 },
  { pattern: "WALMART", categoryName: "Shopping", priority: 60 },
  { pattern: "TARGET", categoryName: "Shopping", priority: 60 },
  { pattern: "BEST BUY", categoryName: "Shopping", priority: 60 },
  { pattern: "HOME DEPOT", categoryName: "Shopping", priority: 60 },
  { pattern: "LOWES", categoryName: "Shopping", priority: 60 },

  // Transportation + travel
  { pattern: "UBER", categoryName: "Transportation", priority: 65 },
  { pattern: "LYFT", categoryName: "Transportation", priority: 65 },
  { pattern: "SHELL", categoryName: "Transportation", priority: 60 },
  { pattern: "CHEVRON", categoryName: "Transportation", priority: 60 },
  { pattern: "EXXON", categoryName: "Transportation", priority: 60 },
  { pattern: "AIRBNB", categoryName: "Travel", priority: 70 },
  { pattern: "VRBO", categoryName: "Travel", priority: 70 },
  { pattern: "MARRIOTT", categoryName: "Travel", priority: 65 },
  { pattern: "HILTON", categoryName: "Travel", priority: 65 },
  { pattern: "HYATT", categoryName: "Travel", priority: 65 },
  { pattern: "DELTA", categoryName: "Travel", priority: 65 },
  { pattern: "UNITED AIRLINES", categoryName: "Travel", priority: 65 },
  { pattern: "SOUTHWEST", categoryName: "Travel", priority: 65 },

  // Utilities / telecom
  { pattern: "COMCAST", categoryName: "Utilities", priority: 65 },
  { pattern: "XFINITY", categoryName: "Utilities", priority: 65 },
  { pattern: "VERIZON", categoryName: "Utilities", priority: 60 },
  { pattern: "AT&T", categoryName: "Utilities", priority: 60 },
  { pattern: "T MOBILE", categoryName: "Utilities", priority: 60 },


  // Housing
  { pattern: "MORTGAGE", categoryName: "Mortgage Payments", priority: 85 },
  { pattern: "ROCKET MORTGAGE", categoryName: "Mortgage Payments", priority: 90 },
  { pattern: "QUICKEN LOANS", categoryName: "Mortgage Payments", priority: 90 },
  { pattern: "MR COOPER", categoryName: "Mortgage Payments", priority: 90 },
  { pattern: "PENNYMAC", categoryName: "Mortgage Payments", priority: 90 },
  { pattern: "LOANDEPOT", categoryName: "Mortgage Payments", priority: 90 },
  { pattern: "FREEDOM MORTGAGE", categoryName: "Mortgage Payments", priority: 90 },
  { pattern: "NEWREZ", categoryName: "Mortgage Payments", priority: 90 },
  { pattern: "RENT PAYMENT", categoryName: "Rent", priority: 80 },
  { pattern: "PROPERTY MANAGEMENT", categoryName: "Rent", priority: 75 },
  { pattern: "HOA", categoryName: "HOA Fees", priority: 80 },


  // Healthcare: dental
  { pattern: "DENTAL", categoryName: "Dental", priority: 85 },
  { pattern: "DENTIST", categoryName: "Dental", priority: 85 },
  { pattern: "ORTHODONT", categoryName: "Dental", priority: 80 },
  { pattern: "ENDODONT", categoryName: "Dental", priority: 80 },
  { pattern: "PERIODONT", categoryName: "Dental", priority: 80 },
  { pattern: "ORAL SURGERY", categoryName: "Dental", priority: 80 },
  { pattern: "DDS", categoryName: "Dental", priority: 70 },
  { pattern: "DMD", categoryName: "Dental", priority: 70 },

  // Healthcare
  { pattern: "CVS", categoryName: "Healthcare", priority: 65 },
  { pattern: "WALGREENS", categoryName: "Healthcare", priority: 65 },



  // Schedule E: cleaning and maintenance
  { pattern: "CLEANING", categoryName: "Cleaning and Maintenance", priority: 85 },
  { pattern: "CLEANER", categoryName: "Cleaning and Maintenance", priority: 85 },
  { pattern: "MAID", categoryName: "Cleaning and Maintenance", priority: 80 },
  { pattern: "JANITORIAL", categoryName: "Cleaning and Maintenance", priority: 80 },
  { pattern: "MAINTENANCE", categoryName: "Cleaning and Maintenance", priority: 85 },
  { pattern: "REPAIR", categoryName: "Cleaning and Maintenance", priority: 75 },
  { pattern: "HANDYMAN", categoryName: "Cleaning and Maintenance", priority: 80 },
  { pattern: "PLUMBING", categoryName: "Cleaning and Maintenance", priority: 75 },
  { pattern: "PLUMBER", categoryName: "Cleaning and Maintenance", priority: 75 },
  { pattern: "ELECTRICAL", categoryName: "Cleaning and Maintenance", priority: 75 },
  { pattern: "ELECTRICIAN", categoryName: "Cleaning and Maintenance", priority: 75 },
  { pattern: "HVAC", categoryName: "Cleaning and Maintenance", priority: 75 },
  { pattern: "LANDSCAP", categoryName: "Cleaning and Maintenance", priority: 70 },
  { pattern: "LAWN CARE", categoryName: "Cleaning and Maintenance", priority: 70 },
  { pattern: "PEST CONTROL", categoryName: "Cleaning and Maintenance", priority: 70 },

  // Insurance
  { pattern: "GEICO", categoryName: "Car Insurance", priority: 85 },
  { pattern: "PROGRESSIVE", categoryName: "Car Insurance", priority: 85 },
  { pattern: "STATE FARM", categoryName: "Car Insurance", priority: 85 },
  { pattern: "ALLSTATE", categoryName: "Car Insurance", priority: 85 },
  { pattern: "LIBERTY MUTUAL", categoryName: "Car Insurance", priority: 85 },
  { pattern: "FARMERS INSURANCE", categoryName: "Car Insurance", priority: 85 },
  { pattern: "USAA INSURANCE", categoryName: "Car Insurance", priority: 85 },
  { pattern: "NATIONWIDE", categoryName: "Car Insurance", priority: 80 },
  { pattern: "TRAVELERS INSURANCE", categoryName: "Car Insurance", priority: 80 },
  { pattern: "ERIE INSURANCE", categoryName: "Car Insurance", priority: 80 },
  { pattern: "AMICA", categoryName: "Car Insurance", priority: 80 },
  { pattern: "ROOT INSURANCE", categoryName: "Car Insurance", priority: 80 },

  // Banking / transfers
  { pattern: "ATM FEE", categoryName: "Bank Fees", priority: 80 },
  { pattern: "SERVICE FEE", categoryName: "Bank Fees", priority: 75 },
  { pattern: "OVERDRAFT", categoryName: "Bank Fees", priority: 80 },
  { pattern: "ZELLE", categoryName: "Transfers", priority: 75 },
  { pattern: "VENMO", categoryName: "Transfers", priority: 70 },
  { pattern: "CASH APP", categoryName: "Transfers", priority: 70 },
  { pattern: "CREDIT CARD PAYMENT", categoryName: "Transfers", priority: 80 },
];
