# 插件系统

插件系统让你无需写代码就能扩展机器人的功能。一个插件就是一段 JSON 描述的 HTTP 请求,把它绑定到一条命令上,机器人就会替你调用对应的 API。

> 插件系统还在开发中,JSON 结构可能会有变动,文档会尽量保持更新。

## 在哪里配置插件

插件在**管理面板**(`/admin`)的 *Plugins* 标签页中配置,不再需要环境变量。每个插件包含:

| 字段 | 说明 |
|---|---|
| **Command** | 触发命令,例如 `/dns` |
| **Description** | 显示在 `/help` 和 Telegram 命令菜单中 |
| **Scope** | 命令菜单在哪些聊天类型中显示:`all_private_chats`、`all_group_chats`、`all_chat_administrators` |
| **Template** | 完整的插件 JSON,或返回该 JSON 的 URL |
| **Env** | 插件私有的环境变量(见下文) |
| **Enabled** | 开关,不删除插件的情况下临时停用 |

保存后运行一次 `/init` 刷新 Telegram 命令菜单,然后在聊天里调用即可,例如 `/dns A www.example.com`。

## 插件结构

插件是一份 JSON 文档,描述请求本身以及如何渲染响应:

```typescript
/**
 * TemplateInputType: 输入数据的类型,将 Telegram 输入的数据转换为对应的数据类型
 * json: JSON格式
 * space-separated: 以空格分隔的字符串
 * comma-separated: 以逗号分隔的字符串
 * text: 文本,不分割(默认值)
 */
export type TemplateInputType = 'json' | 'space-separated' | 'comma-separated' | 'text';

/**
 * TemplateBodyType: 请求体的类型
 * json: JSON格式, 此时 content 字段的值是一个对象,key 为固定值,Value 支持插值
 * form: 表单格式, 此时 content 字段的值是一个对象,key 为固定值,Value 支持插值
 * text: 文本格式, 此时 content 字段的值是一个字符串,支持插值
 */
export type TemplateBodyType = 'json' | 'form' | 'text';

/**
 * TemplateResponseType: 响应体的类型
 * json: 将响应体解析为 JSON,交给输出模板渲染
 * text: 将响应体作为文本,交给输出模板渲染
 * blob: 二进制格式,响应体直接返回(作为图片发送)
 */
export type TemplateResponseType = 'json' | 'text' | 'blob';

/**
 * TemplateOutputType: 输出数据的类型
 * text: 将渲染结果作为纯文本发送到 Telegram
 * image: 将渲染结果作为图片 URL 发送到 Telegram
 * html: 将渲染结果作为 HTML 发送到 Telegram
 * markdown: 将渲染结果作为 Markdown 发送到 Telegram
 */
export type TemplateOutputType = 'text' | 'image' | 'html' | 'markdown';

export interface RequestTemplate {
    url: string; // 必选, 支持插值
    method: string; // 必选
    headers: { [key: string]: string }; // 可选, Key 为固定值,Value 支持插值
    input: {
        type: TemplateInputType;
        required: boolean; // 为 true 时,命令不带输入会直接报错
    };
    query: { [key: string]: string }; // 可选, Key 为固定值,Value 支持插值
    body: {
        type: TemplateBodyType;
        content: { [key: string]: string } | string;
    };
    response: {
        content: { // 必选, 请求成功时的处理
            input_type: TemplateResponseType;
            output_type: TemplateOutputType;
            output: string;
        };
        error: { // 必选, 请求失败时的处理
            input_type: TemplateResponseType;
            output_type: TemplateOutputType;
            output: string;
        };
    };
}
```

## 插值变量

传入模板的数据结构如下:

```json
{
    "DATA": [],
    "ENV": {}
}
```

- `DATA` — 用户输入,结构由 `input.type` 决定。例如 `space-separated` 时,`/dns A www.example.com` 会得到 `DATA = ["A", "www.example.com"]`,用 `{{DATA[0]}}`、`{{DATA[1]}}` 引用。
- `ENV` — 插件自己的环境变量,在管理面板的 *Env* 字段中配置。例如 `{"access_token": "xxxx"}` 对应 `{{ENV.access_token}}`。插件环境变量与全局环境相互隔离。

## 插值语法

可以在你自己部署的测试页面上练习:`https://<你的域名>/interpolate`。

```html
<b>{{title}}</b>
<b>
{{#each item in items}}
  {{#each:item i in item}}
    {{i.value}}
    {{#if i.enable}}
      {{#if:sub i.subEnable}}
        sub enable
      {{#else:sub}}
        sub disable
      {{/if:sub}}
    {{#else}}
      disable
    {{/if}}
  {{/each:item}}
{{/each}}
</b>
```

1. `{{title}}` — 变量引用,支持键路径和数组下标(`{{DATA[0]}}`、`{{ENV.access_token}}`)。
2. `{{#each item in items}}` — 遍历数组 items,item 是当前元素,必须有结束标记 `{{/each}}`。
3. `{{#each:item i in item}}` — 嵌套遍历需要给遍历起别名,结束标记也要带上别名 `{{/each:item}}`。
4. `{{#if i.enable}}` — 条件判断。判断条件不支持表达式,只能判断非空和非零,必须有结束标记 `{{/if}}`。
5. `{{#else}}` — 条件判断的否定分支。
6. `{{#if:sub i.subEnable}}` — 嵌套条件判断需要给条件起别名,结束标记也要带上别名 `{{/if:sub}}`。
7. `{{}}` 内不能有空格,否则会被当作字符串解析。例如 `{{ title }}` 是错误的写法。
8. `{{.}}` — 当前数据节点,可用于 `#each` 内或全局。

## 示例

1. [DNS 查询插件](../../plugins/dns.json) — `/dns A www.example.com`
2. [英语词典插件](../../plugins/dicten.json) — `/dict hello`
3. [图片生成插件](../../plugins/pollinations.json) — `/pollinations 一只在太空中的猫`
4. [LivePair 图片生成插件](../../plugins/livepair.json) — `/livepair 一只在太空中的猫`

   使用 OpenAI 兼容的 `POST /v1/agent/images/generations` 接口。在插件的 *Env* 字段中设置 `LIVEPAIR_API_KEY`（来自 [livepairai.com](https://livepairai.com) 的 `lp_` 密钥）和 `LIVEPAIR_MODEL`（例如 `seedream-5.0` 或 `qwen-image-3`，完整列表见 `GET /v1/agent/models`）。
