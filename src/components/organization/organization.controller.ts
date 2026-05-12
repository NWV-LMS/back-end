import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage, MulterFile } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';
import { CreateOrganizationDto } from '../../libs/dto/organization/create-organization.dto';
import { UpdateOrganizationDto } from '../../libs/dto/organization/update-organization.dto';
import { Organ } from '../../libs/dto/organization/organization-response.dto';
import { QueryOrganizationDto } from '../../libs/dto/organization/query-organization.dto';
import { UpdateOrganizationStatusDto } from '../../libs/dto/organization/update-organization-status.dto';
import {
  PaginatedOrganizationResponseDto,
  PlatformOrganizationDto,
} from '../../libs/dto/organization/platform-organization.dto';
import { UserService } from '../user/user.service';
import { OrganizationService } from './organization.service';
import { User } from '../../libs/dto/user/user-response.dto';
import { QueryPlatformUserDto } from '../../libs/dto/user/query-platform-user.dto';
import { PaginatedUserResponseDto } from '../../libs/dto/user/paginated-user-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { OrganizationId } from '../auth/decorators/organization-id.decorator';
import { OrganizationIdGuard } from '../auth/guards/organization-id.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly userService: UserService,
    private readonly organizationService: OrganizationService,
  ) {}

  @Post('register')
  public async register(@Body() input: CreateOrganizationDto): Promise<Organ> {
    return await this.organizationService.register(input);
  }

  @Get('all')
  getAllUsers(): Promise<User[]> {
    return this.userService.getAllUsers();
  }

  @Get('users')
  listUsers(
    @Query() query: QueryPlatformUserDto,
  ): Promise<PaginatedUserResponseDto> {
    return this.userService.listUsersForPlatform(query);
  }

  @Patch(':id')
  public async updateOrganization(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdateOrganizationDto,
  ): Promise<Organ> {
    return await this.organizationService.updateOrganization(id, input);
  }

  @Get('organizations')
  listOrganizations(
    @Query() query: QueryOrganizationDto,
  ): Promise<PaginatedOrganizationResponseDto> {
    return this.organizationService.listOrganizations(query);
  }

  @Patch('organizations/:id/status')
  updateOrganizationStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdateOrganizationStatusDto,
  ): Promise<PlatformOrganizationDto> {
    return this.organizationService.updateOrganizationStatus(id, input);
  }
}
@UseGuards(JwtAuthGuard, RolesGuard, OrganizationIdGuard)
@Controller('organizations/settings')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Roles(UserRole.ADMIN)
  @Post('logo')
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'logos'),
        filename: (_req, file: MulterFile, cb) => {
          cb(null, `${uuidv4()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (
        _req: unknown,
        file: MulterFile,
        cb: (err: Error | null, accept: boolean) => void,
      ) => {
        if (!file.mimetype.match(/^image\/(jpeg|jpg|png|webp|gif)$/)) {
          return cb(
            new BadRequestException('Only image files are allowed (jpeg, jpg, png, webp, gif)'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadLogo(
    @UploadedFile() file: MulterFile,
    @OrganizationId() organizationId: string,
    @Req() req: Request,
  ): Promise<{ logo_url: string }> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const logoUrl = `${baseUrl}/uploads/logos/${file.filename}`;
    await this.organizationService.updateOrganization(organizationId, {
      logo_url: logoUrl,
    });
    return { logo_url: logoUrl };
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Get()
  getSettings(@OrganizationId() organizationId: string) {
    return this.organizationService.getOrganization(organizationId);
  }

  @Roles(UserRole.ADMIN)
  @Patch()
  updateSettings(
    @OrganizationId() organizationId: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationService.updateOrganization(organizationId, dto);
  }
}
