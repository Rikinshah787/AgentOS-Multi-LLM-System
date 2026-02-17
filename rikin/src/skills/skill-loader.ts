import * as fs from 'fs';
import * as path from 'path';
import { SkillDefinition } from '../core/types';

/**
 * Skill Loader — parses markdown skill files into executable definitions.
 * Skills define reusable agent abilities with prompt templates.
 */
export class SkillLoader {
  private skills: Map<string, SkillDefinition> = new Map();
  private skillsDir: string;

  constructor(private workspaceRoot: string) {
    this.skillsDir = path.join(workspaceRoot, 'agent_os', 'skills');
  }

  async initialize(): Promise<void> {
    this.loadAllSkills();
  }

  private loadAllSkills(): void {
    if (!fs.existsSync(this.skillsDir)) return;
    const files = fs.readdirSync(this.skillsDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.skillsDir, file), 'utf-8');
        const skill = this.parseSkillMarkdown(content, file);
        if (skill) {
          this.skills.set(skill.name, skill);
        }
      } catch (err) {
        console.error(`[AgentOS] Failed to parse skill ${file}:`, err);
      }
    }
  }

  /**
   * Parse a markdown skill file into a SkillDefinition.
   *
   * Expected format:
   * ---
   * name: Code Reviewer
   * triggers: review, check, audit
   * agents: * (or comma-separated ids)
   * risk: low
   * ---
   * # Code Reviewer
   * Description of what this skill does.
   *
   * ## Prompt Template
   * ```
   * Review the following code for...
   * ```
   */
  private parseSkillMarkdown(content: string, filename: string): SkillDefinition | null {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return null;

    const frontmatter = frontmatterMatch[1];
    const body = content.slice(frontmatterMatch[0].length).trim();

    const getName = (key: string): string => {
      const match = frontmatter.match(new RegExp(`${key}:\\s*(.+)`));
      return match ? match[1].trim() : '';
    };

    const name = getName('name') || filename.replace('.md', '');
    const triggers = getName('triggers').split(',').map(s => s.trim()).filter(Boolean);
    const agents = getName('agents').split(',').map(s => s.trim()).filter(Boolean);
    const risk = getName('risk') as 'low' | 'high' || 'auto';

    // Extract prompt template from code block
    const promptMatch = body.match(/```\n?([\s\S]*?)\n?```/);
    const promptTemplate = promptMatch ? promptMatch[1].trim() : body;

    // Extract description (everything before ## Prompt Template)
    const descMatch = body.match(/^([\s\S]*?)(?=##\s*Prompt|```)/);
    const description = descMatch ? descMatch[1].replace(/^#.*\n/, '').trim() : '';

    return {
      name,
      description,
      triggerKeywords: triggers,
      promptTemplate,
      allowedAgents: agents.length === 0 || agents[0] === '*' ? ['*'] : agents,
      risk,
    };
  }

  getSkill(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  getAllSkills(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  /**
   * Find a skill that matches a trigger keyword.
   */
  findByTrigger(keyword: string): SkillDefinition | undefined {
    const lower = keyword.toLowerCase();
    for (const skill of this.skills.values()) {
      if (skill.triggerKeywords.some(t => lower.includes(t.toLowerCase()))) {
        return skill;
      }
    }
    return undefined;
  }

  /**
   * Reload all skills from disk.
   */
  reload(): void {
    this.skills.clear();
    this.loadAllSkills();
  }

  dispose(): void {
    this.skills.clear();
  }
}
