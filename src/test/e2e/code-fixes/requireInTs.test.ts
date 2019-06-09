import { expect } from 'chai';
import { commands, window, TextEditor } from "vscode";
import * as path from "path";
import { unlinkSync } from "fs";
import { openEditorForTestFile, testFolderPath } from "../../support";

describe("requireInTs", function () {
  const tsFileName = "requireInTs.ts";
  const jsFileName = "requireInTs.js";

  afterEach(function() {
    unlinkSync(path.join(testFolderPath + tsFileName));
  });

  it("applies requireInTs code fix to converted file", async function() {
    await openEditorForTestFile(jsFileName);
    await commands.executeCommand("extension.toTypeScript");
    const currentEditor = window.activeTextEditor as TextEditor;
    const convertedContent = `import x = require("y");`;
    expect(currentEditor.document.fileName).to.equal(path.join(testFolderPath + tsFileName));
    expect(currentEditor.document.getText()).to.equal(convertedContent);
  });
});
