declare module 'multer' {
  interface DiskStorageOptions {
    destination?:
      | string
      | ((
          req: unknown,
          file: MulterFile,
          cb: (err: Error | null, dest: string) => void,
        ) => void);
    filename?: (
      req: unknown,
      file: MulterFile,
      cb: (err: Error | null, name: string) => void,
    ) => void;
  }

  interface MulterFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    destination: string;
    filename: string;
    path: string;
    buffer: Buffer;
  }

  interface StorageEngine {}

  function diskStorage(options: DiskStorageOptions): StorageEngine;

  export { diskStorage, MulterFile, StorageEngine, DiskStorageOptions };
}
