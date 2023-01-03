import { buildTSFixIds, getEditorConfig } from './configUtils';
import { FileTextChanges, Project, SourceFile, FormatCodeSettings} from 'ts-morph';
import { Uri, TextDocument } from 'vscode';
import { TSAdapter } from './adapters/tsAdapterInterface';
import { tsAdapterFor } from './adapters/adapterFactory';

export class TSFile {
  private adapter: TSAdapter;
  private project: Project;
  private sourceFile: SourceFile;

  constructor (document: TextDocument, overwrite: boolean=false) {
    this.adapter = tsAdapterFor(document);
    this.project = new Project();
    this.sourceFile = this.buildSourceFile(overwrite);
  }

  public getFileUri(): Uri {
    return Uri.file(this.adapter.getFileName());
  }

  public toTypeScript(): Promise<void> {
    const fixIds = buildTSFixIds();
    const editorConfig = getEditorConfig(this.getFileUri());

    fixIds.forEach((fixId: string) => {
      const fixes = this.project.getLanguageService().getCombinedCodeFix(this.sourceFile, fixId, editorConfig);
      fixes.getChanges().forEach((change: FileTextChanges) => change.applyChanges({ overwrite: true }));
    });

    
    return this.sourceFile.save();
  }

  public generateImportsInTsFile(){
    this.project.createSourceFile(
      this.adapter.getFileName(),
      this.regenerateContent(this.adapter.getFileContent()), { overwrite: true }
    )
    return this.sourceFile.save();
  }

  public replaceModifiersInTsFile(){
    this.project.createSourceFile(
      this.adapter.getFileName(),
      this.replaceModifiers(this.adapter.getFileContent()), { overwrite: true }
    )
    return this.sourceFile.save();
  }

  public removeBindDecorator()
  {
    this.project.createSourceFile(
      this.adapter.getFileName(),
      this.removeBindDecoratorFromFile(this.adapter.getFileContent()), { overwrite: true }
    )
    return this.sourceFile.save();
  }
  
  public removeBindDecoratorFromFile = (fileContent: string): string =>
  {
    if(fileContent.includes('import bind from \'bind-decorator\''))
    {
      const regex = /@bind((.|\n|\r|\s)*?)(?=\()/g;
      let bindedMethods = fileContent.match(regex);
      let nativeBinds: string='\n';
      if(bindedMethods)
      {
        bindedMethods.forEach(element => {
          let methodName = element.replace('@bind', '').trim();
          methodName = methodName.replace('private ', '');
          methodName = methodName.replace('protected ', '').trim();
          //this.finish = this.finish.bind(this);`Converting ${path}`
          nativeBinds+= `\t\tthis.${methodName} = this.${methodName}.bind(this);\n`;
        });


        const regex = /constructor\(((.|\n|\r|\s)*?)\)/g;
        let constructorResult = fileContent.match(regex);

        let insertIndex=0;
        if(constructorResult)
        {
          console.log("jest constructor");
          if(fileContent.includes('super();'))
          {
            console.log("jest super");
            insertIndex = fileContent.indexOf('super();') + "super();".length;
            fileContent = fileContent.slice(0, insertIndex) + nativeBinds + fileContent.slice(insertIndex);
          }
          else
          {
            const r = /constructor\(((.|\n|\r|\s)*?)\).{/g;
            let match = r.exec(fileContent);
            if (match) {
              insertIndex = fileContent.indexOf('constructor(') + match[0].toString().length;
              fileContent = fileContent.slice(0, insertIndex) + nativeBinds + fileContent.slice(insertIndex);
            }
            else
            {
              //nie znalazł contructora ??
              return fileContent;
            }
          }
        }
        else
        {
          // nie ma constructora
          const regexClass = /\nclass((.|\n|\r|\s)*?){/g;
          let match = regexClass.exec(fileContent);
          if (match) {
            let constructorString ='';

            if(match[0].toString().includes('extends'))
            {
              console.log("jest extends");
              constructorString = `\n\tconstructor(){\n\t\tsuper();${nativeBinds}\t}\n`;
            }  
            else
              constructorString = `\n\tconstructor(){${nativeBinds}\t}\n`;

            insertIndex = match.index + match[0].toString().length;
            fileContent = fileContent.slice(0, insertIndex) + constructorString + fileContent.slice(insertIndex);
          }
          else
          {
            //nie znalazł class ??
            return fileContent;
          }
            
          // let match = str.match(/[abc]/gi);
          // let firstIndex = str.indexOf(match[0]);
        }

        fileContent = fileContent.replaceAll('@bind', '');
        fileContent = fileContent.replace('import bind from \'bind-decorator\';\r\n', '');
      }

    }
    return fileContent;
  }
  
  public regenerateContent = (fileContent: string): string =>
  {
    fileContent=this.generateImports(fileContent)+fileContent;
    fileContent=this.removeDefines(fileContent);

    return fileContent;
  }

  public replaceModifiers = (fileContent: string): string =>
  {
    const regex = /constructor\(((.|\n|\r|\s)*?)\)/g;
    let constructorResult = fileContent.match(regex);
    if(constructorResult)
    {
      let constructorString = constructorResult.toString();
      constructorString = constructorString.toString().replaceAll("__", "private __").toString();
      constructorString = constructorString.toString().replaceAll("(_", "(protected _").toString();
      constructorString = constructorString.toString().replaceAll(/, _(?=[^_])/g, ", protected _").toString();
      constructorString=constructorString.toString();
      fileContent = fileContent.toString().replace(regex, constructorString.toString()).toString();
    }
    return fileContent;
  }
  

  public generateImports = (fileContent: string): string =>{
    let regex = /define\(((.|\r|\n|s)*?)\) {/g;
    let defineRegexResult = fileContent.match(regex);
    if(defineRegexResult)
    {
      let defineString = defineRegexResult.toString();
      let lines=defineString.split('\n')
      lines.shift();
      lines.pop();
      let index=Math.floor(lines.length/2);
  
      lines.splice(index, 1);
      index=Math.floor(lines.length/2);
  
      let imports=[];
  
      regex = /^.*?(?=:)/g;
      for(let i=0; i<index; i++)
      {
          imports.push("import " +lines[index+i].match(regex)?.toString().trim().replace(',', '')+" from "+lines[i].trim().replace(',', '').replaceAll('"', "'")+";");
      }
      imports.sort(function (a, b) {
          function getRaw(s: string) {
              return s.replace("{ ", '');
          }
      
          return getRaw(a).localeCompare(getRaw(b));
      });

      let finalString  = imports.join('\r\n')+'\r\n';

      return finalString;
    }
    else
      return '';
  };

  public removeDefines = (fileContent: string): string =>{
    let regex = /define\(((.|\r|\n|s)*?)\) {/g;
    let defineRegexResult = fileContent.replace(regex, '');
    if(defineRegexResult.substring(defineRegexResult.length - 3) == "});" )
    {
      defineRegexResult = defineRegexResult.slice(0, -3)
    }

    return defineRegexResult;
  };

  private buildSourceFile(overwrite: boolean): SourceFile {
    if(overwrite)
    {
      return this.project.createSourceFile(
        this.adapter.getFileName(),
        this.adapter.getFileContent(), {overwrite: true}
      );
    }
    return this.project.createSourceFile(
      this.adapter.getFileName(),
      this.adapter.getFileContent()
    );
  }
}
