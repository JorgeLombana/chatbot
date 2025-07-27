import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Chatbot API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/api/chatbot/health (GET)', () => {
    return request(app.getHttpServer()).get('/api/chatbot/health').expect(200);
  });

  it('/api/chatbot/chat (POST)', () => {
    return request(app.getHttpServer())
      .post('/api/chatbot/chat')
      .send({ query: 'Hello' })
      .expect(400); // Will fail without proper API keys, but tests endpoint exists
  });
});
