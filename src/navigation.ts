import * as vscode from "vscode";
import { ParsedRoute } from "./route-parser";

export async function navigateToRoute(route: ParsedRoute): Promise<void> {
  const uri = vscode.Uri.file(route.filePath);
  const doc = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(doc);
  const pos = new vscode.Position(route.line - 1, route.column - 1);
  editor.selection = new vscode.Selection(pos, pos);
  editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
}
