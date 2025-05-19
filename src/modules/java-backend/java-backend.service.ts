import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AxiosRequestConfig } from 'axios'
import FormData from 'form-data'
import { firstValueFrom } from 'rxjs'

@Injectable()
export class JavaBackendService {
  private readonly logger = new Logger(JavaBackendService.name)
  private javaBackendUrl: string
  private accessToken: string | null = null

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.javaBackendUrl = this.configService.get<string>('VITE_API_BASEURL')
  }

  async login(): Promise<any> {
    const url = `${this.javaBackendUrl}/user/login`
    const data = {
      telephone: '15159529478',
      password: '123456a',
    }

    try {
      this.logger.log(`Attempting to login to Java backend at ${url}`)
      const response = await firstValueFrom(this.httpService.post(url, data))
      const res = response.data.data
      this.logger.log(`Java后端登录成功。响应数据：${res.token}`)
      // 存储返回的token
      if (res && res.token) {
        this.accessToken = res.token
        this.logger.log('Token存储成功')
      }
      else {
        this.logger.warn('登录响应中未找到token')
      }

      return res
    }
    catch (error) {
      this.logger.error(`登录失败: ${error.message}`)
      throw error
    }
  }

  /**
   * 通用请求方法，处理 Java 后端接口调用及 401 错误重试。
   * @param method 请求方法 (get, post, put, delete)
   * @param endpoint 请求端点
   * @param data 请求体数据 (可选)
   * @param config Axios 请求配置 (可选)
   * @returns Promise<T> 响应数据
   */
  async request<T>(method: 'get' | 'post' | 'put' | 'delete', endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const url = `${this.javaBackendUrl}${endpoint}`
    const requestConfig: AxiosRequestConfig = {
      ...config,
      headers: {
        'x-access-token': this.accessToken || '',
        ...(config?.headers || {}),
      },
    }

    try {
      this.logger.log(`请求方法 ${method.toUpperCase()}，端点 ${endpoint}`)
      let response

      // 根据请求类型发送请求
      if (data && data.files && requestConfig.headers['Content-Type'] === 'multipart/form-data') {
        // 对于文件上传，需要构建 FormData
        const formData = new FormData()
        for (const key in data) {
          if (key !== 'files') {
            formData.append(key, data[key])
          }
        }
        for (const fieldName in data.files) {
          const fileData = data.files[fieldName]
          formData.append(fieldName, fileData.buffer, {
            filename: fileData.filename,
            contentType: fileData.mimetype,
          })
        }
        const formHeaders = formData.getHeaders()
        requestConfig.headers = {
          ...requestConfig.headers,
          ...formHeaders,
        }
        response = await firstValueFrom(this.httpService.post<T>(url, formData, requestConfig))
      }
      else {
        switch (method) {
          case 'get':
            response = await firstValueFrom(this.httpService.get<T>(url, requestConfig))
            break
          case 'post':
            response = await firstValueFrom(this.httpService.post<T>(url, data, requestConfig))
            break
          case 'put':
            response = await firstValueFrom(this.httpService.put<T>(url, data, requestConfig))
            break
          case 'delete':
            response = await firstValueFrom(this.httpService.delete<T>(url, requestConfig))
            break
        }
      }

      // 检查响应体中的 code 是否为 401
      if (response.data && response.data.code === 401) {
        this.logger.warn(`收到 401 响应码，请求方法 ${method.toUpperCase()}，端点 ${endpoint}。尝试重新登录并重试...`)
        try {
          // 重新登录
          await this.login()
          // 使用新的 token 重试之前的请求
          this.logger.log(`重新登录成功后，重试请求方法 ${method.toUpperCase()}，端点 ${endpoint}。`)
          // 更新 headers 中的 token
          requestConfig.headers['x-access-token'] = this.accessToken || ''

          // 根据请求类型重试
          if (data && data.files && requestConfig.headers['Content-Type'] === 'multipart/form-data') {
            // 对于文件上传，需要重新构建 FormData
            const formData = new FormData()
            for (const key in data) {
              if (key !== 'files') {
                formData.append(key, data[key])
              }
            }
            for (const fieldName in data.files) {
              const fileData = data.files[fieldName]
              formData.append(fieldName, fileData.buffer, {
                filename: fileData.filename,
                contentType: fileData.mimetype,
              })
            }
            const formHeaders = formData.getHeaders()
            requestConfig.headers = {
              ...requestConfig.headers,
              ...formHeaders,
              'x-access-token': this.accessToken || '',
            }
            response = await firstValueFrom(this.httpService.post<T>(url, formData, requestConfig))
          }
          else {
            switch (method) {
              case 'get':
                response = await firstValueFrom(this.httpService.get<T>(url, requestConfig))
                break
              case 'post':
                response = await firstValueFrom(this.httpService.post<T>(url, data, requestConfig))
                break
              case 'put':
                response = await firstValueFrom(this.httpService.put<T>(url, data, requestConfig))
                break
              case 'delete':
                response = await firstValueFrom(this.httpService.delete<T>(url, requestConfig))
                break
            }
          }
          this.logger.log(`重试请求方法 ${method.toUpperCase()}，端点 ${endpoint} 成功。`)
          return response.data // 返回重试成功的结果
        }
        catch (retryError) {
          this.logger.error(`重试请求方法 ${method.toUpperCase()}，端点 ${endpoint} 失败: ${retryError.message}`)
          throw retryError // 重试失败，抛出重试的错误
        }
      }
      else if (response.data && response.data.code === 20001) {
        // 检查是否是文件上传解析错误
        return {
          code: 400,
          message: '文件上传失败，请检查文件大小或稍后重试。',
          error: 'Multipart request parsing failed',
        } as any
      }

      return response.data
    }
    catch (error) {
      // 检查是否是 401 错误
      let response = error.response
      if (response && response.status === 401) {
        this.logger.warn(`收到 401 错误，请求方法 ${method.toUpperCase()}，端点 ${endpoint}。尝试重新登录并重试...`)
        try {
          // 重新登录
          await this.login()
          // 使用新的 token 重试之前的请求
          this.logger.log(`重新登录成功后，重试请求方法 ${method.toUpperCase()}，端点 ${endpoint}。`)
          // 更新 headers 中的 token
          requestConfig.headers['x-access-token'] = this.accessToken || ''

          // 根据请求类型重试
          if (data && data.files && requestConfig.headers['Content-Type'] === 'multipart/form-data') {
            // 对于文件上传，需要重新构建 FormData
            const formData = new FormData()
            for (const key in data) {
              if (key !== 'files') {
                formData.append(key, data[key])
              }
            }
            for (const fieldName in data.files) {
              const fileData = data.files[fieldName]
              formData.append(fieldName, fileData.buffer, {
                filename: fileData.filename,
                contentType: fileData.mimetype,
              })
            }
            const formHeaders = formData.getHeaders()
            requestConfig.headers = {
              ...requestConfig.headers,
              ...formHeaders,
              'x-access-token': this.accessToken || '',
            }
            response = await firstValueFrom(this.httpService.post<T>(url, formData, requestConfig))
          }
          else {
            switch (method) {
              case 'get':
                response = await firstValueFrom(this.httpService.get<T>(url, requestConfig))
                break
              case 'post':
                response = await firstValueFrom(this.httpService.post<T>(url, data, requestConfig))
                break
              case 'put':
                response = await firstValueFrom(this.httpService.put<T>(url, data, requestConfig))
                break
              case 'delete':
                response = await firstValueFrom(this.httpService.delete<T>(url, requestConfig))
                break
            }
          }
          this.logger.log(`重试请求方法 ${method.toUpperCase()}，端点 ${endpoint} 成功。`)
          return response.data // 返回重试成功的结果
        }
        catch (retryError) {
          this.logger.error(`重试请求方法 ${method.toUpperCase()}，端点 ${endpoint} 失败: ${retryError.message}`)
          throw retryError // 重试失败，抛出重试的错误
        }
      }
      else {
        // 不是 401 错误，或者重试失败，抛出原始错误
        this.logger.error(`请求方法 ${method.toUpperCase()}，端点 ${endpoint} 失败: ${error.message}`)
        throw error
      }
    }
  }
}
