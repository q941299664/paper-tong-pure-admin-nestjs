import { All, Controller, Req, Res } from '@nestjs/common'
import { Request, Response } from 'express'
import { FastifyReply, FastifyRequest } from 'fastify'

import { JavaBackendService } from './java-backend.service'

@Controller('admin')
export class JavaBackendController {
  constructor(private readonly javaBackendService: JavaBackendService) {}

  /**
   * 处理所有以/admin开头的请求，去掉/admin前缀后转发到Java后端
   * @param req 请求对象
   * @param res 响应对象
   */
  @All('*')
  async handleAdminRequest(@Req() req: Request & FastifyRequest, @Res() res: FastifyReply) {
    try {
      // 获取原始URL并去掉/admin前缀
      const originalUrl = req.originalUrl
      const endpoint = originalUrl.replace(/^\/admin/, '')
      // 获取请求方法（小写）
      const method = req.method.toLowerCase()

      // 只处理支持的HTTP方法
      if (!['get', 'post', 'put', 'delete'].includes(method)) {
        return res.status(405).send({ message: '不支持的HTTP方法' })
      }

      // 处理文件上传请求
      if (endpoint.includes('/formatPaperFile/upload') && req.isMultipart()) {
        const data = {}
        const files = {}

        // 处理multipart/form-data请求
        const parts = req.parts()

        for await (const part of parts) {
          if (part.type === 'file') {
            // 处理文件部分
            const buffer = await part.toBuffer()
            files[part.fieldname] = {
              filename: part.filename,
              mimetype: part.mimetype,
              buffer,
            }
          }
          else {
            // 处理普通字段
            data[part.fieldname] = part.value
          }
        }

        // 转发请求到Java后端，包含文件和表单数据
        const result = await this.javaBackendService.request(
          'post',
          endpoint,
          { ...data, files },
          {
            headers: {
              ...req.headers as any,
              'Content-Type': 'multipart/form-data',
            },
            params: req.query,
          },
        )

        return res.send(result)
      }

      // 获取请求体数据（非文件上传请求）
      const data = method === 'get' ? undefined : req.body

      // 转发请求到Java后端
      const result = await this.javaBackendService.request(
        method as 'get' | 'post' | 'put' | 'delete',
        endpoint,
        data,
        {
          headers: req.headers as any, // 转发原始请求头
          params: req.query, // 转发查询参数
        },
      )

      // 返回Java后端的响应
      return res.send(result)
    }
    catch (error) {
      // 错误处理
      // 其他错误按原逻辑处理
      return res.status(error.response?.status || 500).send({
        message: error.message,
        error: error.response?.data || '转发请求到Java后端时出错',
      })
    }
  }
}
