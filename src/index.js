import * as core from '@actions/core';
import * as github from '@actions/github';
import _ from 'lodash';
import * as YAML from 'yaml';

import Action from './action';
import * as fsHelper from './lib/fs-helper';
import { undefinedOnEmpty } from './utils';

const cliConfigPath = `${process.env.HOME}/.jira.d/config.yml`;
const configPath = `${process.env.HOME}/jira/config.yml`;

export async function writeKey(result) {
  if (result.length === 0) {
    return;
  }
  const issue = result[0];
  core.debug(`Detected issueKey: ${issue.key}`);
  core.debug(`Saving ${issue.key} to ${cliConfigPath}`);
  core.debug(`Saving ${issue.key} to ${configPath}`);

  fsHelper.mkdir(configPath);
  fsHelper.mkdir(cliConfigPath);
  try {
    // Expose created issue's key as an output
    if (fsHelper.existsSync(configPath)) {
      const _config = YAML.parse(fsHelper.loadFileSync(configPath));
      const yamledResult = YAML.stringify(issue);
      const extendedConfig = { ..._config, ...issue };

      fsHelper.writeFileSync(configPath, YAML.stringify(extendedConfig));

      fsHelper.appendFileSync(cliConfigPath, yamledResult);
    }
  } catch (error) {
    core.debug(error);
  }
}

export const exec = async () => {
  try {
    const { context } = github;
    let configFromFile = {};
    try {
      if (fsHelper.existsSync(configPath)) {
        configFromFile = YAML.parse(fsHelper.loadFileSync(configPath));
      }
    } catch (error) {
      core.debug(`Error finding/parsing config file: ${error}, moving on`);
    }

    const argv = parseArguments(configFromFile);
    const config = {
      baseUrl: argv?.jiraConfig?.baseUrl,
      token: argv?.jiraConfig?.token,
      email: argv?.jiraConfig?.email,
      string: argv?.string,
    };
    const result = await new Action({
      context,
      argv,
      config,
    }).execute();
    await writeKey(result);
  } catch (error) {
    core.setFailed(error);
  }
};

export function concatStringList(providedString1, providedString2) {
  const stringArray = [..._.split(_.trim(providedString1), ','), ..._.split(_.trim(providedString2), ',')].flatMap(
    (f) => (f && f.length > 0 ? [f] : []),
  );
  return [...new Set(stringArray)];
}
export function parseArguments(providedJiraConfig) {
  const fromList = ['string', 'commits', 'pull_request', 'branch'];
  const jiraConfig = {
    baseUrl: '',
    token: '',
    email: '',
  };
  jiraConfig.baseUrl = process.env.JIRA_BASE_URL ?? providedJiraConfig?.baseUrl ?? core.getInput('jira_base_url');
  if (!undefinedOnEmpty(jiraConfig.baseUrl)) {
    throw new Error('JIRA_BASE_URL env not defined, or supplied as action input jira_base_url');
  }
  jiraConfig.token = process.env.JIRA_API_TOKEN ?? providedJiraConfig?.token ?? core.getInput('jira_api_token');
  if (!undefinedOnEmpty(jiraConfig.token)) {
    throw new Error('JIRA_API_TOKEN env not defined, or supplied as action input jira_api_token');
  }
  jiraConfig.email = process.env.JIRA_USER_EMAIL ?? providedJiraConfig?.email ?? core.getInput('jira_user_email');
  if (!undefinedOnEmpty(jiraConfig.email)) {
    throw new Error('JIRA_USER_EMAIL env not defined, or supplied as action input jira_user_email');
  }

  return {
    string: undefinedOnEmpty(core.getInput('string')),
    from: _.includes(fromList, core.getInput('from')) ? core.getInput('from') : 'commits',
    headRef: undefinedOnEmpty(core.getInput('head-ref')),
    baseRef: undefinedOnEmpty(core.getInput('base-ref')),
    includeMergeMessages: core.getBooleanInput('include-merge-messages'),
    GitHubIssues: core.getBooleanInput('generate-github-issues'),
    GitHubMilestones: core.getBooleanInput('generate-github-milestones'),
    returns: undefinedOnEmpty(core.getInput('returns')) ?? 'first',
    updatePRTitle: core.getBooleanInput('standardize-pr-title'),
    transitionChain: undefinedOnEmpty(core.getInput('jira-transition-chain')),
    transitionOnNewBranch: core.getInput('jira-transition-on-new-branch'),
    transitionOnPrOpen: core.getInput('jira-transition-on-pr-open'),
    transitionOnPrApproval: core.getInput('jira-transition-on-pr-approval'),
    transitionOnPrMerge: core.getInput('jira-transition-on-pr-merge'),
    gist_private: core.getBooleanInput('gist-private'),
    gist_name: core.getInput('create-gist-output-named'),
    jiraTransition: core.getInput('jira-transition'),

    fixVersions: [concatStringList(core.getInput('fix-versions'), core.getInput('fix-version'))],
    replaceFixVersions: core.getBooleanInput('replace-fix-versions'),
    jiraConfig,
  };
}

exec();
