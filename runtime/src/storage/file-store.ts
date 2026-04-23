import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export class FileStore {
  async ensureDirectory(directoryPath: string): Promise<void> {
    await mkdir(directoryPath, { recursive: true });
  }

  async writeJson(filePath: string, value: unknown): Promise<void> {
    await this.ensureDirectory(path.dirname(filePath));
    const payload = JSON.stringify(value, null, 2);
    await writeFile(filePath, `${payload}\n`, "utf8");
  }

  async readJson<T>(filePath: string): Promise<T> {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  }

  async readText(filePath: string): Promise<string> {
    return readFile(filePath, "utf8");
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async writeText(filePath: string, value: string): Promise<void> {
    await this.ensureDirectory(path.dirname(filePath));
    await writeFile(filePath, value, "utf8");
  }
}
