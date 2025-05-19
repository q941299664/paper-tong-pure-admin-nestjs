import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AxiosRequestConfig } from 'axios'
import { firstValueFrom } from 'rxjs'
import * as FormData from 'form-data'

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
      this.logger.log('Java backend login successful')
      // 存储返回的token
      if (response.data && response.data.token) {
        this.accessToken = response.data.token
        this.logger.log('Token stored successfully')
      }
      else {
        this.logger.warn('No token found in login response')
      }

      return response.data
    }
    catch (error) {
      this.logger.error(`Failed to login to Java backend: ${error.message}`)
      throw error
    }
  }

  /**
   * 获取存储的访问令牌
   */
  getAccessToken(): string | null {
    return this.accessToken
  }

  /**
   * 向Java后端发送带有认证token的请求
   * @param method 请求方法
   * @param endpoint 请求端点
   * @param data 请求数据
   * @param config 额外的请求配置
   */
  async request<T>(method: 'get' | 'post' | 'put' | 'delete', endpoint: string, data?: any, config: AxiosRequestConfig = {}): Promise<T> {
    const url = `${this.javaBackendUrl}${endpoint}`

    // 确保headers存在
    if (!config.headers) {
      config.headers = {}
    }

    // 如果有token，添加到请求头
    if (this.accessToken) {
      config.headers['x-access-token'] = this.accessToken
    }

    try {
      let response

      // 处理文件上传请求
      if (data && data.files && config.headers['Content-Type'] === 'multipart/form-data') {
        // 创建FormData对象
        const formData = new FormData();
        
        // 添加非文件字段
        for (const key in data) {
          if (key !== 'files') {
            formData.append(key, data[key]);
          }
        }
        
        // 添加文件
        for (const fieldName in data.files) {
          const fileData = data.files[fieldName];
          // 使用Buffer直接添加到FormData
          formData.append(fieldName, fileData.buffer, {
            filename: fileData.filename,
            contentType: fileData.mimetype
          });
        }
        
        // 使用FormData发送请求
        // 让form-data设置正确的headers
        const formHeaders = formData.getHeaders();
        
        config.headers = {
          ...config.headers,
          ...formHeaders,
          'x-access-token': this.accessToken || ''
        };
        
        response = await firstValueFrom(this.httpService.post<T>(url, formData, config));

      } else {
        // 处理普通请求
        switch (method) {
          case 'get':
            response = await firstValueFrom(this.httpService.get<T>(url, config))
            break
          case 'post':
            response = await firstValueFrom(this.httpService.post<T>(url, data, config))
            break
          case 'put':
            response = await firstValueFrom(this.httpService.put<T>(url, data, config))
            break
          case 'delete':
            response = await firstValueFrom(this.httpService.delete<T>(url, config))
            break
        }
      }

      return response.data
    }
    catch (error) {
      this.logger.error(`Failed to ${method} ${endpoint}: ${error.message}`)
      throw error
    }
  }
}
