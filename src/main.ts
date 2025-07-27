import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { validateConfig, NodeEnvironment } from './shared/config/configuration';

/**
 * Application bootstrap function
 * Initializes the NestJS application with security, validation, and documentation
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    const config = validateConfig();
    logger.log('Configuration validated successfully');

    const app = await NestFactory.create(AppModule);

    app.setGlobalPrefix('api');
    logger.log('Global API prefix set to: /api');

    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
          },
        },
      }),
    );

    const allowedOrigins = (
      process.env.ALLOWED_ORIGINS?.trim() || 'http://localhost:3000'
    )
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

    app.enableCors({
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    });

    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        disableErrorMessages: config.nodeEnv === NodeEnvironment.PRODUCTION,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    if (config.nodeEnv !== NodeEnvironment.PRODUCTION) {
      const swaggerConfig = new DocumentBuilder()
        .setTitle('Chatbot API')
        .setDescription(
          'AI-powered chatbot with product search and currency conversion',
        )
        .setVersion('1.0')
        .addServer(`http://localhost:${config.port}`, 'Development server')
        .build();

      const document = SwaggerModule.createDocument(app, swaggerConfig);
      SwaggerModule.setup('api/docs', app, document, {
        swaggerOptions: {
          persistAuthorization: true,
          tagsSorter: 'alpha',
          operationsSorter: 'alpha',
        },
      });

      logger.log(
        `Swagger documentation available at: http://localhost:${config.port}/api/docs`,
      );
    } else {
      logger.log('Swagger documentation disabled in production mode');
    }

    app.enableShutdownHooks();
    await app.listen(config.port);

    logger.log(`🚀 Application successfully started on port ${config.port}`);
    logger.log(
      `📚 API endpoints available at: http://localhost:${config.port}/api`,
    );
    logger.log(`📖 Swagger docs: http://localhost:${config.port}/api/docs`);
    logger.log(
      `🤖 Chatbot API: http://localhost:${config.port}/api/chatbot/chat`,
    );
    logger.log(
      `❤️ Health check: http://localhost:${config.port}/api/chatbot/health`,
    );
    logger.log(`🔒 Security features: Helmet, CORS, Rate Limiting enabled`);
    logger.log(`🌍 Environment: ${config.nodeEnv}`);
  } catch (error) {
    logger.error('❌ Failed to start application', error);
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('❌ Unhandled bootstrap error', error);
  process.exit(1);
});
