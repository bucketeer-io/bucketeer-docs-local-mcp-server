import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await fsp.stat(dirPath);
    return stats.isDirectory();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fsp.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

export async function readFile(filePath: string): Promise<string> {
  return fsp.readFile(filePath, 'utf-8');
}

export async function writeFile(
  filePath: string,
  content: string
): Promise<void> {
  await ensureDirectoryExists(path.dirname(filePath));
  await fsp.writeFile(filePath, content, 'utf-8');
}

export async function listFiles(
  directory: string,
  extension?: string
): Promise<string[]> {
  try {
    const files = await fsp.readdir(directory);
    if (extension) {
      return files.filter((file) => file.endsWith(extension));
    }
    return files;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []; // Directory doesn't exist, return empty list
    }
    throw error;
  }
}

export async function removeDirectory(dirPath: string): Promise<void> {
  await fsp.rm(dirPath, { recursive: true, force: true });
}
