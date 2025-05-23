import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
// import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'

import { AppModule } from './app.module'

async function bootstrap() {
  const adapter = new FastifyAdapter({
    // 增加请求体大小限制到 20MB
    bodyLimit: 20 * 1024 * 1024,
  })
  adapter.enableCors({
    origin: ['*'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'x-lang'],
    maxAge: 86400, // 预检请求结果缓存时间（秒）
  })

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter)

  await app.register(helmet)
  
  // 注册multipart插件以支持文件上传
  await app.register(multipart, {
    limits: {
      fileSize: 20 * 1024 * 1024, // 限制文件大小为20MB
    },
  })

  // 使用 Winston logger 作为全局日志
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER))

  // const config = new DocumentBuilder()
  //   .setTitle('Web Crawler')
  //   .setDescription('api 接口文档')
  //   .setVersion('1.0')
  //   .addBearerAuth({
  //     type: 'http',
  //     description: '基于 jwt 的认证'
  //   })
  //   .build()
  // const document = SwaggerModule.createDocument(app, config)
  // SwaggerModule.setup('api-doc', app, document)

  const configService = app.get(ConfigService)

  const port = configService.get('NEST_SERVER_PORT')
    ? Number.parseInt(configService.get('NEST_SERVER_PORT'), 10)
    : 3000

  await app.listen(port, '0.0.0.0')
}

bootstrap()
