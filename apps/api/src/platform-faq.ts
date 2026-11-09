import { Body, Controller, Get, Injectable, Put, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsString, MaxLength, MinLength, ValidateNested } from "class-validator";
import { PrismaService } from "./prisma.service";
import { JwtAuthGuard, SystemGuard } from "./auth";

export class FaqEntryDto {
  @IsString() @MinLength(5) @MaxLength(220) question!: string;
  @IsString() @MinLength(5) @MaxLength(3000) answer!: string;
  @IsBoolean() isActive!: boolean;
}
export class SaveFaqDto {
  @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => FaqEntryDto)
  items!: FaqEntryDto[];
}

@Injectable()
export class PlatformFaqService {
  constructor(private readonly db: PrismaService) {}

  publicList() {
    return this.db.platformFaq.findMany({
      where: { isActive: true },
      select: { id: true, question: true, answer: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      take: 20,
    });
  }

  systemList() {
    return this.db.platformFaq.findMany({
      select: { id: true, question: true, answer: true, isActive: true, position: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      take: 20,
    });
  }

  async replace(items: FaqEntryDto[]) {
    const prepared = items.map((item, position) => ({
      question: item.question.trim(), answer: item.answer.trim(), isActive: item.isActive, position,
    }));
    await this.db.$transaction(async tx => {
      await tx.platformFaq.deleteMany();
      if (prepared.length) await tx.platformFaq.createMany({ data: prepared });
    });
    return this.systemList();
  }
}

@Controller()
export class PlatformFaqController {
  constructor(private readonly faq: PlatformFaqService) {}

  @Get("public/faq")
  publicList() { return this.faq.publicList(); }

  @UseGuards(JwtAuthGuard, SystemGuard)
  @Get("system/faq")
  systemList() { return this.faq.systemList(); }

  @UseGuards(JwtAuthGuard, SystemGuard)
  @Put("system/faq")
  save(@Body() body: SaveFaqDto) { return this.faq.replace(body.items); }
}
