// src/ai-chat/services/gemini.service.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface GeminiMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

@Injectable()
export class GeminiService {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly model: string = 'gemini-2.5-flash'; // Hoặc thử 'gemini-2.5-flash-preview-11-2025' nếu cần

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY') || '';
    this.apiUrl = `https://generativelanguage.googleapis.com/v1/models/${this.model}:generateContent`; // v1 stable

    if (!this.apiKey) {
      console.warn('⚠️ GEMINI_API_KEY not found in .env');
    }
  }

  /**
   * Gọi Gemini API với context và history
   */
  async generateResponse(
    userMessage: string,
    chatHistory: { role: 'user' | 'assistant'; content: string }[],
    userContext?: any,
  ): Promise<string> {
    if (!this.apiKey) {
      throw new HttpException(
        'Gemini API key not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    try {
      // Tạo system prompt với context user
      const systemPrompt = this.buildSystemPrompt(userContext);

      // Chuyển đổi history sang format Gemini (xen kẽ user/model)
      const historyContents: GeminiMessage[] = chatHistory.map((msg) => ({
        role: msg.role === 'assistant' ? ('model' as const) : ('user' as const),
        parts: [{ text: msg.content }],
      }));

      // XÂY DỰNG CONTENTS MỚI: Nối system prompt vào user message để tránh hai 'user' liên tiếp
      let currentUserText = userMessage;
      if (systemPrompt) {
        currentUserText = `${systemPrompt}\n\n${userMessage}`; // Nối system prompt + user message
      }

      const contents: GeminiMessage[] = [
        // History (nếu có, đã xen kẽ đúng)
        ...historyContents,
        // Entry user hiện tại (với system prompt nối vào)
        {
          role: 'user' as const,
          parts: [{ text: currentUserText }],
        },
      ];

      // Log request body để debug (xóa sau khi test)

      const response = await axios.post(
        `${this.apiUrl}?key=${this.apiKey}`,
        {
          contents,
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE',
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE',
            },
          ],
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
        },
      );

      // Log full response để debug

      const aiResponse =
        response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!aiResponse) {
        throw new Error(
          `No response from Gemini API. Candidates: ${JSON.stringify(response.data?.candidates || 'empty')}`,
        );
      }

      return aiResponse.trim();
    } catch (error) {
      console.error('Gemini API Error:', error.response?.data || error.message);

      if (error.response?.status === 429) {
        throw new HttpException(
          'API rate limit exceeded. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (error.response?.status === 404) {
        throw new HttpException(
          'Model not found. Please check the Gemini model name and API version.',
          HttpStatus.NOT_FOUND,
        );
      }

      throw new HttpException(
        `Failed to generate AI response: ${error.response?.data?.error?.message || error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Tạo system prompt với thông tin user
   */
  private buildSystemPrompt(userContext?: any): string {
    let prompt = `Bạn là trợ lý AI tư vấn tình cảm thông minh, ấm áp và đồng cảm trên một ứng dụng hẹn hò. 
Nhiệm vụ của bạn là:
- Lắng nghe và hiểu sâu sắc vấn đề của người dùng
- Đưa ra lời khuyên chân thành, thực tế về tình yêu, hẹn hò, mối quan hệ
- Khuyến khích tích cực nhưng không đưa ra lời hứa hão
- Giữ giọng điệu thân thiện, không phán xét
- Trả lời bằng tiếng Việt tự nhiên, dễ hiểu

`;

    if (userContext) {
      prompt += `Thông tin người dùng:\n`;
      if (userContext.name) prompt += `- Tên: ${userContext.name}\n`;
      if (userContext.age) prompt += `- Tuổi: ${userContext.age}\n`;
      if (userContext.gender) prompt += `- Giới tính: ${userContext.gender}\n`;
      if (userContext.lookingFor)
        prompt += `- Đang tìm kiếm: ${userContext.lookingFor}\n`;
      if (userContext.aboutMe)
        prompt += `- Giới thiệu: ${userContext.aboutMe}\n`;
    }

    prompt += `\nHãy tư vấn dựa trên thông tin này một cách cá nhân hóa và chân thành.`;

    return prompt;
  }
}
