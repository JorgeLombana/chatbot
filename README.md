<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

# AI-Powered Chatbot API

An intelligent e-commerce chatbot built with NestJS and OpenAI, featuring product search and currency conversion capabilities through function calling.

## 🚀 Features

- **OpenAI GPT-3.5-turbo Integration**: Advanced natural language processing with function calling
- **Product Search Tool**: Search through product catalog (returns exactly 2 relevant products)
- **Currency Conversion Tool**: Real-time currency conversion using Open Exchange Rates API
- **4-Step LLM Pipeline**: Receive → Analyze → Execute Tool → Respond
- **RESTful API**: Clean, documented endpoints with Swagger integration
- **Comprehensive Error Handling**: Robust error management and logging
- **Rate Limiting**: Built-in protection against API abuse
- **TypeScript**: Full type safety and modern development experience

## 🛠️ Tech Stack

- **Framework**: NestJS with TypeScript
- **AI Integration**: OpenAI Chat Completion API with Function Calling
- **Currency API**: Open Exchange Rates API
- **Data Processing**: CSV parsing for product catalog
- **Documentation**: Swagger/OpenAPI
- **Validation**: class-validator and class-transformer
- **HTTP Client**: Axios with NestJS HTTP module

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- OpenAI API key
- Open Exchange Rates API key (free tier available)

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/JorgeLombana/chatbot
   cd chatbot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env
   ```
   
   Configure your `.env` file with the required API keys:
   ```env
   # OpenAI Configuration
   OPENAI_API_KEY=sk-your-openai-api-key-here
   
   # Open Exchange Rates Configuration
   EXCHANGE_RATES_API_KEY=your-32-character-app-id-here
   
   # Application Configuration
   NODE_ENV=development
   PORT=3000
   ```

4. **Add product data**
   - Place your `Full Stack Test products_list.csv` file in the `data/` directory
   - The CSV should contain product information for the search functionality

## 🚀 Running the Application

```bash
# Development mode with hot reload
npm run start:dev

# Production mode
npm run start:prod

# Debug mode
npm run start:debug
```

The API will be available at `http://localhost:3000`

## 📚 API Documentation

Access the interactive Swagger documentation at:
- **Local**: `http://localhost:3000/api/docs`

### Main Endpoints

#### Chat with AI Assistant
```
POST /chatbot/chat
```

**Request Body:**
```json
{
  "query": "I am looking for a phone",
  "conversationId": "optional-conversation-id",
  "messages": []
}
```

**Response:**
```json
{
  "response": "I found some great phones for you! Here are 2 options...",
  "conversationId": "chat-1234567890-abc123",
  "toolUsed": "searchProducts",
  "finishReason": "tool_calls",
  "executionTimeMs": 1250
}
```

#### Health Check
```
GET /chatbot/health
```

## 🧪 Testing the Chatbot

Try these example queries:

1. **Product Search**:
   - "I am looking for a phone"
   - "I am looking for a present for my dad"
   - "How much does a watch cost?"

2. **Currency Conversion**:
   - "What is the price of the watch in Euros?"
   - "How many Canadian Dollars are 350 Euros?"

3. **Mixed Queries**:
   - "Show me laptops under $1000 and convert the price to EUR"

## 🔨 Development

```bash
# Run tests
npm run test

# End-to-end tests
npm run test:e2e

# Test coverage
npm run test:cov

# Lint code
npm run lint

# Format code
npm run format
```

## 🏗️ Architecture

The application follows a clean architecture pattern:

```
src/
├── chatbot/                 # Main chatbot module
│   ├── controllers/         # REST API controllers
│   ├── services/           # Business logic (LLM service)
│   ├── infrastructure/     # External services (OpenAI, Currency API)
│   ├── dto/               # Data transfer objects
│   ├── entities/          # Domain entities
│   └── interfaces/        # Service contracts
├── shared/                # Shared utilities
│   ├── config/           # Configuration management
│   └── filters/          # Exception filters
└── main.ts               # Application bootstrap
```

### 4-Step LLM Pipeline

1. **Receive**: Process user query and conversation context
2. **Analyze**: OpenAI determines which tools (if any) to use
3. **Execute**: Run selected tools (searchProducts/convertCurrencies)
4. **Respond**: Generate natural language response with tool results

## 🛡️ Security Features

- **Rate Limiting**: Configurable request limits
- **Input Validation**: Comprehensive DTO validation
- **CORS**: Configurable cross-origin resource sharing
- **Helmet**: Security headers
- **Environment Variables**: Secure configuration management

## 📊 Monitoring & Logging

- **Health Checks**: Service availability monitoring
- **Structured Logging**: Request/response logging with Winston
- **Error Tracking**: Comprehensive error handling and reporting
- **Performance Metrics**: Execution time tracking

## 📝 Environment Variables

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment mode | No | `development` |
| `PORT` | Server port | No | `3000` |
| `OPENAI_API_KEY` | OpenAI API key | Yes | `sk-...` |
| `EXCHANGE_RATES_API_KEY` | Exchange rates API key | Yes | `abc123...` |
| `PRODUCTS_CSV_PATH` | Path to products CSV | No | `data/products.csv` |

## 📄 License

This project is licensed under the UNLICENSED license.
