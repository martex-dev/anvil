import { describe, expect, it } from 'vitest';

import { gitEnv } from './git-env';

describe('gitEnv', () => {
	it('keeps git messages untranslated but preserves the character set', () => {
		expect(
			gitEnv({
				LANG: 'de_DE.UTF-8',
				LANGUAGE: 'de',
				LC_ALL: 'de_DE.UTF-8',
				LC_MESSAGES: 'de_DE.UTF-8',
			}),
		).toEqual({
			LANG: 'de_DE.UTF-8',
			LC_CTYPE: 'de_DE.UTF-8',
			LC_MESSAGES: 'C',
			GIT_TERMINAL_PROMPT: '0',
		});
	});

	it('inherits what git and hooks need and strips what would hijack git', () => {
		const env = gitEnv({
			Path: 'C:/bin',
			USERPROFILE: 'C:/Users/marto',
			GCM_INTERACTIVE: 'auto',
			GIT_SSH: 'C:/Program Files/PuTTY/plink.exe',
			GIT_SSH_COMMAND: 'ssh -i ~/.ssh/work',
			GIT_CONFIG_GLOBAL: 'D:/dotfiles/gitconfig',
			XDG_CONFIG_HOME: '/home/marto/.config',
			GNUPGHOME: 'C:/Users/marto/.gnupg',
			VIRTUAL_ENV: 'C:/proj/.venv',
			JAVA_HOME: 'C:/jdk',
			// Stripped: another app's prompts and editors, a parent git's repository and config.
			GIT_ASKPASS: 'C:/other-app/askpass.exe',
			Ssh_AskPass: 'C:/other-app/ssh-askpass.exe',
			VSCODE_GIT_IPC_HANDLE: 'pipe',
			EDITOR: 'code --wait',
			GIT_DIR: 'C:/elsewhere/.git',
			GIT_INDEX_FILE: 'C:/elsewhere/.git/index',
			GIT_CONFIG_COUNT: '1',
			GIT_CONFIG_KEY_0: 'core.sshCommand',
			GIT_CONFIG_VALUE_0: 'evil',
			GIT_TRACE: '1',
		});
		expect(env).toEqual({
			Path: 'C:/bin',
			USERPROFILE: 'C:/Users/marto',
			GCM_INTERACTIVE: 'auto',
			GIT_SSH: 'C:/Program Files/PuTTY/plink.exe',
			GIT_SSH_COMMAND: 'ssh -i ~/.ssh/work',
			GIT_CONFIG_GLOBAL: 'D:/dotfiles/gitconfig',
			XDG_CONFIG_HOME: '/home/marto/.config',
			GNUPGHOME: 'C:/Users/marto/.gnupg',
			VIRTUAL_ENV: 'C:/proj/.venv',
			JAVA_HOME: 'C:/jdk',
			LC_MESSAGES: 'C',
			GIT_TERMINAL_PROMPT: '0',
		});
	});
});
