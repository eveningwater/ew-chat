import { marked } from 'marked';
import hljs from 'highlight.js';

// 配置marked选项
export function configureMarked() {
    marked.setOptions({
        highlight: function (code: string, lang: string) {
            if (lang && hljs.getLanguage(lang)) {
                return hljs.highlight(code, { language: lang }).value;
            }
            return hljs.highlightAuto(code).value;
        },
        breaks: true,
        gfm: true,
        smartLists: true,
        smartypants: true
    });
}

// 渲染Markdown内容
export function renderMarkdown(content: string): string {
    try {
        const html = marked.parse(content, {
            gfm: true,           // 启用GitHub风格Markdown
            breaks: true,       // 将换行符转换为<br>
            smartLists: true,   // 使用更智能的列表行为
            smartypants: true,  // 使用更智能的标点符号
            highlight: function (code: string, lang: string) {
                if (lang && hljs.getLanguage(lang)) {
                    return hljs.highlight(code, { language: lang }).value;
                }
                return hljs.highlightAuto(code).value;
            }
        });

        // 为代码块添加复制按钮
        return html.replace(
            /<pre><code class="language-([\w-]+)">(([\s\S])*?)<\/code><\/pre>/g,
            (_match: unknown, language: string, code: string) => {
                return `
          <div class="code-block">
            <div class="code-header">
              <span class="code-language">${language}</span>
              <button class="code-copy-button" onclick="(function(btn){navigator.clipboard.writeText(btn.parentNode.nextElementSibling.textContent);const icon=btn.querySelector('i');icon.className='fas fa-check';setTimeout(()=>icon.className='fas fa-copy',2000)})(this)">
                <i class="fas fa-copy"></i>
              </button>
            </div>
            <pre><code class="language-${language}">${code}</code></pre>
          </div>
        `;
            }
        );
    } catch (error) {
        console.error('Markdown parsing error:', error);
        return content;
    }
} 