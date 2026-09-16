import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
} from "@nestjs/common";
import type { PreviewAccessRole } from "../../config/env.js";
import { CreatePreviewSessionWorkflow } from "../../workflows/create-preview-session.workflow.js";

type CreatePreviewSessionBody = {
  role?: unknown;
};

@Controller("preview-access")
export class PreviewAccessController {
  constructor(
    private readonly createPreviewSession: CreatePreviewSessionWorkflow,
  ) {}

  @Post("session")
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  async createSession(
    @Ip() clientIp: string,
    @Body() body: CreatePreviewSessionBody | undefined,
  ): Promise<{ customToken: string; role: PreviewAccessRole }> {
    return await this.createPreviewSession.run({
      clientIp,
      role: body?.role,
    });
  }
}
