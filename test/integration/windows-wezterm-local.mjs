// Opt-in live Windows regression: node test/integration/windows-wezterm-local.mjs
// Requires WezTerm, Git Bash, native pi, and configured model credentials.
import { mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createSurface, sendLongCommand, pollForExit, closeSurface, shellEscape } from '../../pi-extension/subagents/cmux.ts';
if (process.platform !== 'win32') throw new Error('Windows-only live regression');
// Run in the already-trusted thesis workspace, not the extension source clone.
process.chdir('C:/毕业论文');
const dir = `${tmpdir().replaceAll('\\', '/')}/pi-子代理 测试`;
mkdirSync(dir, { recursive: true });
const session = `${dir}/verify-${Date.now()}.jsonl`;
const extension = fileURLToPath(new URL('../../pi-extension/subagents/subagent-done.ts', import.meta.url));
const pane = createSurface('Local launch regression');
console.log(`TEST_PANE=${pane} SESSION=${session}`);
try {
  const prompt = '本地回归测试，不写文件。Windows 命令只能走 powershell.exe -NoProfile -Command；Python 只能走 conda run -n eeg1 python。使用 read 工具读取 C:/毕业论文/wiki/README.md，然后回复 LOCAL_SUBAGENT_E2E_OK 和第一行标题。';
  const command = `export HTTP_PROXY=http://127.0.0.1:7890 HTTPS_PROXY=http://127.0.0.1:7890; PI_SUBAGENT_AUTO_EXIT=1 PI_SUBAGENT_SESSION=${shellEscape(session)} PI_SUBAGENT_NAME=local-regression pi --session ${shellEscape(session)} -e ${shellEscape(extension)} --model ${shellEscape(process.env.PI_REGRESSION_MODEL || 'opencode-go/glm-5.3-flash:high')} ${shellEscape(prompt)}; code=$?; echo __SUBAGENT_DONE_${'$'}{code}__`;
  sendLongCommand(pane, command, { scriptPath: `${dir}/启动脚本 with space.sh` });
  const result = await pollForExit(pane, AbortSignal.timeout(120000), { interval: 1000, sessionFile: session });
  console.log('EXIT_RESULT=' + JSON.stringify(result));
  const entries = readFileSync(session, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  const parts = entries.filter(entry => entry.message?.role === 'assistant').flatMap(entry => entry.message.content ?? []);
  const replies = parts.filter(part => part.type === 'text').map(part => part.text).join('\n');
  console.log('ASSISTANT_REPLY=' + replies);
  if (result.exitCode !== 0 || !replies.includes('LOCAL_SUBAGENT_E2E_OK') || !parts.some(part => part.type === 'toolCall' && part.name === 'read')) throw new Error('End-to-end verification failed');
  closeSurface(pane);
  closeSurface(pane);
  console.log('E2E_AND_DOUBLE_CLOSE_PASS');
} catch (error) {
  console.error(execFileSync('wezterm', ['cli','get-text','--pane-id',pane], {encoding:'utf8'}));
  throw error;
} finally { closeSurface(pane); }
