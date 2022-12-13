import {
  ExtensionContext,
  ViewColumn,
  commands,
  window,
  workspace,
  Uri,
  TextDocument,
} from 'vscode';

import * as decaffeinate from 'decaffeinate';
import * as fs from 'fs';
import { TSFile } from './tsFile';
import { CoffeeToJsAdapter } from './adapters/coffeeToJsAdapter';
import { Project } from 'ts-morph';
import { ExecOptions } from 'child_process';

const logger = window.createOutputChannel('.toTypeScript()');

const CURRENT_DIR = '--== Current Dir ==--';
let counterOfFiles = 0;
let notFormatedFiles: Array<string> = [];

const selectDirectory = async (options: Array<string>): Promise<string> => {
  const pick = await window.showQuickPick([CURRENT_DIR, ...options]);

  return pick ?? '';
};

const getSourcesDir = async (): Promise<string> => {
  if (workspace.workspaceFolders !== undefined) {
    const base = workspace.workspaceFolders[0];

    let path = base.uri.fsPath;

    while (true) {
      const selectedDirectory = await selectDirectory(getDirectories(path));

      if (selectedDirectory === CURRENT_DIR || selectedDirectory === '') {
        break;
      }

      path = `${path}/${selectedDirectory}`;
    }

    return path;
  }
  return '';
};

const getDirectories = (path: string): Array<string> => {
  return fs
    .readdirSync(path, { withFileTypes: true })
    .filter((directory) => directory.isDirectory())
    .map((directory) => directory.name);
};

const isFile = (path: string): boolean => {
  const stats = fs.lstatSync(path);
  return stats.isFile();
};

const convert = async (path: string, extension: string) => {
  if (isFile(path)) {
    if (!path.endsWith(extension)) return;

    logger.appendLine(`Converting ${path}`);

    const openedFile = await workspace.openTextDocument(Uri.file(path));

    try {
      const tsFile = new TSFile(openedFile);
      console.log(`Converting ${path}`);

      await tsFile.toTypeScript();

      console.log(`Generated ${tsFile.getFileUri()}`);
      counterOfFiles++;
    } catch {
      console.log('failed generating file', path.replace(/.coffee/, '.ts'));
      notFormatedFiles.push(path.replace(/.coffee/, '.ts'));
    }

    return;
  }

  const dir = fs.readdirSync(path);

  for (const nested of dir) {
    await convert(`${path}/${nested}`, extension);
  }
};

const currentFile = async () => {
  if (window.activeTextEditor) {
    const tsFile = new TSFile(window.activeTextEditor.document);
    await tsFile.toTypeScript();
    return commands.executeCommand(
      'vscode.open',
      tsFile.getFileUri(),
      ViewColumn.Beside
    );
  }
};

const coffeeToTs = async (path: string) => {
  await convert(path, '.coffee');
};

const jsToTs = async (path: string) => {
  await convert(path, '.js');
};

const coffeeToJs = async (path: string) => {
  const extension = '.coffee';
  if (isFile(path)) {
    if (!path.endsWith(extension)) return;

    logger.appendLine(`Converting ${path}`);

    const dupa = await workspace.openTextDocument(Uri.file(path));

    const jsFile = new CoffeeToJsAdapter(dupa);

    const newFile = new Project().createSourceFile(
      jsFile.getFileName(),
      jsFile.getFileContent()
    );
    newFile.save();

    logger.appendLine(`Generated ${jsFile.getFileName}`);

    return;
  }

  const dir = fs.readdirSync(path);
  dir.map((nested) => {
    coffeeToJs(`${path}/${nested}`);
  });
};

const trySwitch = async(pick: string) => {
  switch (pick) {
    case 'Current file':
      await currentFile();
      break;
    case 'Directory: JavaScript to TypeScript':
      await jsToTs(await getSourcesDir());
      break;
    case 'Directory: CoffeeScript to TypeScript':
      await coffeeToTs(await getSourcesDir());
      break;
    case 'Directory: CoffeeScript to JavaScript':
      await coffeeToJs(await getSourcesDir());
      break;
  }
}

export function activate(context: ExtensionContext) {
  context.subscriptions.push(
    commands.registerCommand('extension.toTypeScript', async () => {
      counterOfFiles = 0;
      notFormatedFiles = [];

      const pick = await window.showQuickPick([
        'Current file',
        'Directory: JavaScript to TypeScript',
        'Directory: CoffeeScript to TypeScript',
        'Directory: CoffeeScript to JavaScript',
      ]);

      await trySwitch(pick ?? "");

      window.showInformationMessage('Files Converted: ' + counterOfFiles);
      console.log("Files that could not be parsed: ");

      notFormatedFiles.forEach(file => console.log(file));

    })
  );
}

export function deactivate() {}
