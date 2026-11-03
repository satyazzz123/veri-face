import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { ImagesService } from './images.service.js';
import { sseManager } from '../../utils/sse-manager.js';
import { ImageListQuery } from '@image-val/shared';

export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  public upload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'No image files provided in the multipart request.',
        });
        return;
      }

      const uploadFiles = files.map((f) => ({
        buffer: f.buffer,
        originalname: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
      }));

      const result = await this.imagesService.uploadImages(uploadFiles);
      res.status(202).json({
        message: 'Images uploaded and queued for processing successfully.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as ImageListQuery;
      const result = await this.imagesService.listImages(query);
      res.status(200).json({
        data: result.items,
        pagination: {
          nextCursor: result.nextCursor,
          hasMore: result.hasMore,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  public getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const image = await this.imagesService.getImage(id);
      res.status(200).json({ data: image });
    } catch (err) {
      next(err);
    }
  };

  public getStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const status = await this.imagesService.getImageStatus(id);
      res.status(200).json({ data: status });
    } catch (err) {
      next(err);
    }
  };

  public delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      await this.imagesService.deleteImage(id);
      res.status(200).json({
        message: `Image ${id} deleted successfully.`,
      });
    } catch (err) {
      next(err);
    }
  };

  public events = (req: Request, res: Response): void => {
    const clientId = (req.query.clientId as string) || crypto.randomUUID();
    sseManager.addClient(clientId, res);
  };
}
