# AppTrack - Job Application Tracker with AI Coach

A modern job application tracking system with AI-powered coaching features to help you manage your job search and improve your application success rate.

## Features

### Core Application Tracking
- 📝 **Application Management** - Track all your job applications in one place
- 📊 **Dashboard Analytics** - Visualize your application statistics and progress
- 🗂️ **Smart Organization** - Filter, sort, and search through applications
- 📅 **Timeline View** - Track application stages from applied to offer
- 🏷️ **Status Tracking** - Monitor application status (Applied, Interview, Offer, etc.)

### AI Coach Features (Premium)
- 🤖 **Job Fit Analysis** - AI-powered analysis of how well you match job requirements
- 💬 **Interview Preparation** - Get personalized interview questions and coaching
- ✉️ **Cover Letter Generation** - AI-assisted cover letter writing
- 📈 **Career Advisor** - Personalized career growth recommendations
- 🎯 **Application Optimization** - Tips to improve your application success rate

### Accessibility & UX
- ♿ **WCAG AA Compliant** - Full accessibility support
- ⌨️ **Keyboard Navigation** - Complete keyboard accessibility
- 🎨 **High Contrast** - Accessible color system with proper contrast ratios
- 📱 **Responsive Design** - Works on all devices

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Clerk
- **Styling**: Tailwind CSS
- **AI Integration**: Replicate API (Llama models)
- **Payments**: Stripe
- **Type Safety**: TypeScript
- **Testing**: Jest & React Testing Library

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- pnpm (recommended) or npm

### Environment Variables

Create a `.env.local` file with the following variables:

```bash
# Database
DATABASE_URL="postgresql://..."

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/"

# Stripe
STRIPE_SECRET_KEY="sk_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Replicate AI
REPLICATE_API_TOKEN="r8_..."

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/apptrack.git
cd apptrack
```

2. Install dependencies:
```bash
pnpm install
# or
npm install
```

3. Set up the database:
```bash
pnpm run db:schema
# or
npm run db:schema
```

4. Run the development server:
```bash
pnpm dev
# or
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
apptrack/
├── app/                    # Next.js app router pages
│   ├── api/               # API routes
│   ├── (dashboard)/       # Dashboard pages
│   └── (auth)/           # Authentication pages
├── components/            # React components
│   ├── accessibility/    # Accessibility components
│   ├── dashboard/        # Dashboard components
│   └── ai/              # AI feature components
├── lib/                  # Utility functions and services
│   ├── db/              # Database schemas and DAL
│   ├── ai/              # AI service integrations
│   └── constants/       # App constants
├── schemas/             # Database migration files
└── types/              # TypeScript type definitions
```

## Development

### Available Scripts

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm test         # Run tests
pnpm test:a11y    # Run accessibility tests
pnpm db:schema    # Update database schema
```

### Task Management

This project uses Task Master AI for development task tracking:

```bash
task-master list     # View all tasks
task-master next     # Get next task to work on
task-master show <id>  # View task details
```

## Testing

```bash
# Run all tests
pnpm test

# Run accessibility tests
pnpm test:a11y

# Run with coverage
pnpm test:coverage

# Watch mode for development
pnpm test:watch
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with Next.js and the modern web stack
- AI features powered by Meta's Llama models via Replicate
- Authentication by Clerk
- Payments processed by Stripe