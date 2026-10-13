# Plugin System

The plugin system lets you extend the bot without writing any code. A plugin is a JSON description of an HTTP request; bind it to a command and the bot calls that API for you.

> The plugin system is still under development; the JSON schema may evolve, and this documentation will be kept up to date as much as possible.

## Where plugins live

Plugins are configured in the **admin panel** (`/admin`) under the *Plugins* tab — no environment variables are needed. Each plugin has:

| Field | Description |
|---|---|
| **Command** | The trigger, e.g. `/dns` |
| **Description** | Shown in `/help` and the Telegram command menu |
| **Scope** | Which chat types show the command in the menu: `all_private_chats`, `all_group_chats`, `all_chat_administrators` |
| **Template** | The full plugin JSON, or a URL that returns the JSON |
| **Env** | Per-plugin environment variables (see below) |
| **Enabled** | Turn the plugin on/off without deleting it |

After saving, run `/init` once to refresh the Telegram command menu, then call the plugin from the chat, e.g. `/dns A www.example.com`.

## Plugin structure

A plugin is a single JSON document describing the request and how to render the response:

```typescript
/**
 * TemplateInputType: how the user input is parsed before being passed to the template
 * json:              parse input as JSON
 * space-separated:   split input on spaces
 * comma-separated:   split input on commas
 * text:              keep as-is (default)
 */
export type TemplateInputType = 'json' | 'space-separated' | 'comma-separated' | 'text';

/**
 * TemplateBodyType: the request body type
 * json:  body.content is an object; keys are literal, values support interpolation
 * form:  form-urlencoded; keys are literal, values support interpolation
 * text:  body.content is a string supporting interpolation
 */
export type TemplateBodyType = 'json' | 'form' | 'text';

/**
 * TemplateResponseType: how the HTTP response is parsed
 * json: parse as JSON and pass to the output template
 * text: pass as text to the output template
 * blob: return the raw binary response directly (sent as a photo)
 */
export type TemplateResponseType = 'json' | 'text' | 'blob';

/**
 * TemplateOutputType: how the rendered result is sent to Telegram
 * text | image | html | markdown
 */
export type TemplateOutputType = 'text' | 'image' | 'html' | 'markdown';

export interface RequestTemplate {
    url: string; // required, supports interpolation
    method: string; // required
    headers: { [key: string]: string }; // optional, keys are literal, values support interpolation
    input: {
        type: TemplateInputType;
        required: boolean; // reject the command with no input when true
    };
    query: { [key: string]: string }; // optional, keys are literal, values support interpolation
    body: {
        type: TemplateBodyType;
        content: { [key: string]: string } | string;
    };
    response: {
        content: { // required, used when the request succeeds
            input_type: TemplateResponseType;
            output_type: TemplateOutputType;
            output: string;
        };
        error: { // required, used when the request fails
            input_type: TemplateResponseType;
            output_type: TemplateOutputType;
            output: string;
        };
    };
}
```

## Interpolation variables

The data passed into the template has this shape:

```json
{
    "DATA": [],
    "ENV": {}
}
```

- `DATA` — the user input, shaped by `input.type`. For example, with `space-separated`, `/dns A www.example.com` produces `DATA = ["A", "www.example.com"]`, referenced as `{{DATA[0]}}` and `{{DATA[1]}}`.
- `ENV` — the plugin's own environment variables, configured in the admin panel's *Env* field. For example `{"access_token": "xxxx"}` becomes `{{ENV.access_token}}`. Plugin env vars are isolated from anything global.

## Interpolation syntax

You can try the syntax live on your own deployment at `https://<your-domain>/interpolate`.

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

1. `{{title}}` — a variable reference; supports key paths and array subscripts (`{{DATA[0]}}`, `{{ENV.access_token}}`).
2. `{{#each item in items}}` — iterate an array; `item` is the current element. Must end with `{{/each}}`.
3. `{{#each:item i in item}}` — nested loops need an alias; the closing tag must repeat it (`{{/each:item}}`).
4. `{{#if i.enable}}` — conditional. Conditions don't support expressions, only non-empty / non-zero checks. Must end with `{{/if}}`.
5. `{{#else}}` — the negative branch of a condition.
6. `{{#if:sub i.subEnable}}` — nested conditions need an alias; the closing tag must repeat it (`{{/if:sub}}`).
7. No spaces inside `{{}}` — `{{ title }}` with spaces is parsed as a literal string, not a variable.
8. `{{.}}` — the current data node, usable inside `#each` or globally.

## Examples

1. [DNS lookup plugin](../../plugins/dns.json) — `/dns A www.example.com`
2. [English dictionary plugin](../../plugins/dicten.json) — `/dict hello`
3. [Image generation plugin](../../plugins/pollinations.json) — `/pollinations a cat in space`
4. [LivePair image generation plugin](../../plugins/livepair.json) — `/livepair a cat in space`

   Uses the OpenAI-compatible `POST /v1/agent/images/generations` endpoint. Set `LIVEPAIR_API_KEY` (`lp_…` key from [livepairai.com](https://livepairai.com)) and `LIVEPAIR_MODEL` (e.g. `seedream-5.0` or `qwen-image-3` — full list in `GET /v1/agent/models`) in the plugin's *Env* field.
