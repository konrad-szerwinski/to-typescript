import { expect } from 'chai';
import { commands, window, TextEditor } from "vscode";
import * as path from "path";
import { unlinkSync } from "fs";
import { openEditorForTestFile, testFolderPath } from "../../support";

describe("fixAwaitInSyncFunction", function () {
  const tsFileName = "fixAwaitInSyncFunction.ts";
  const jsFileName = "fixAwaitInSyncFunction.js";

  afterEach(function() {
    unlinkSync(path.join(testFolderPath + tsFileName));
  });

  it("applies fixAwaitInSyncFunction code fix to converted file", async function() {
    await openEditorForTestFile(jsFileName);
    await commands.executeCommand("extension.toTypeScript");
    const currentEditor = window.activeTextEditor as TextEditor;
    const convertedContent = `async () => {\n  await fetch("https://example.com");\n}\n`;
    expect(currentEditor.document.fileName).to.equal(path.join(testFolderPath + tsFileName));
    expect(currentEditor.document.getText()).to.equal(convertedContent);
  });
});
