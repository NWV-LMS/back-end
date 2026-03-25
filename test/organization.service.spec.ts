import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationService } from '../src/components/organization/organization.service';
import { DatabaseService } from '../src/database/database.service';

describe('OrganizationService', () => {
  let service: OrganizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        { provide: DatabaseService, useValue: {} },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
