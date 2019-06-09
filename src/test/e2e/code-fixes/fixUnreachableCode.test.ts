import { expect } from 'chai';
import { commands, window, TextEditor } from "vscode";
import * as path from "path";
import { unlinkSync } from "fs";
import { openEditorForTestFile, testFolderPath } from "../../support";

describe("fixUnreachableCode", function () {
  const tsFileName = "fixUnreachableCode.ts";
  const jsFileName = "fixUnreachableCode.js";

  afterEach(function() {
    unlinkSync(path.join(testFolderPath + tsFileName));
  });

  it("applies fixUnreachableCode code fix to converted file", async function() {
    await openEditorForTestFile(jsFileName);
    await commands.executeCommand("extension.toTypeScript");
    const currentEditor = window.activeTextEditor as TextEditor;
    const convertedContent = `() => {\n  return 1;\n}\n`;
    expect(currentEditor.document.fileName).to.equal(path.join(testFolderPath + tsFileName));
    expect(currentEditor.document.getText()).to.equal(convertedContent);
  });
});
