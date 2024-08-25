import { interpolate } from './interpolate';

export type TemplateInputType = 'json' | 'space-separated' | 'comma-separated' | 'text';
export type TemplateBodyType = 'json' | 'form' | 'text';
export type TemplateResponseType = 'json' | 'text';
export type TemplateOutputType = 'text' | 'image' | 'html' | 'markdown';

export interface RequestTemplate {
    url: string;
    method: string;
    headers: { [key: string]: string };
    input: {
        type: TemplateInputType;
    };
    query: { [key: string]: string };
    body: {
        type: TemplateBodyType;
        content: { [key: string]: string } | string;
    };
    response: {
        content: {
            input_type: TemplateResponseType;
            output_type: TemplateOutputType;
            output: string;
        };
        error: {
            input_type: TemplateResponseType;
            output_type: TemplateOutputType;
            output: string;
        };
    };
}

function interpolateObject(obj: any, data: any): any {
    if (obj === null || obj === undefined) {
        return null;
    }
    if (typeof obj === 'string') {
        return interpolate(obj, data);
    }
    if (Array.isArray(obj)) {
        return obj.map(item => interpolateObject(item, data));
    }
    if (typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = interpolateObject(value, data);
        }
        return result;
    }
    return obj;
}

export async function executeRequest(template: RequestTemplate, data: any): Promise<{ content: string; type: TemplateOutputType }> {
    const urlRaw = interpolate(template.url, data, encodeURIComponent);
    const url = new URL(urlRaw);

    if (template.query) {
        for (const [key, value] of Object.entries(template.query)) {
            url.searchParams.append(key, interpolate(value, data));
        }
    }

    const method = template.method;
    const headers = Object.fromEntries(
        Object.entries(template.headers || {}).map(([key, value]) => {
            return [key, interpolate(value, data)];
        }),
    );
    for (const key of Object.keys(headers)) {
        if (headers[key] === null) {
            delete headers[key];
        }
    }

    let body = null;
    if (template.body) {
        if (template.body.type === 'json') {
            body = JSON.stringify(interpolateObject(template.body.content, data));
        } else if (template.body.type === 'form') {
            body = new URLSearchParams();
            for (const [key, value] of Object.entries(template.body.content)) {
                body.append(key, interpolate(value, data));
            }
        } else {
            body = interpolate(template.body.content as string, data);
        }
    }

    const response = await fetch(url, {
        method,
        headers,
        body,
    });

    const renderOutput = async (type: TemplateResponseType, temple: string, response: Response): Promise<string> => {
        switch (type) {
            case 'text':
                return interpolate(temple, await response.text());
            case 'json':
            default:
                return interpolate(temple, await response.json());
        }
    };
    if (!response.ok) {
        const content = await renderOutput(template.response?.error?.input_type, template.response.error?.output, response);
        return {
            type: template.response.error.output_type,
            content,
        };
    }
    const content = await renderOutput(template.response.content?.input_type, template.response.content?.output, response);
    return {
        type: template.response.content.output_type,
        content,
    };
}

export function formatInput(input: string, type: TemplateInputType): string | string[] | object {
    if (type === 'json') {
        return JSON.parse(input);
    } else if (type === 'space-separated') {
        return input.split(/\s+/);
    } else if (type === 'comma-separated') {
        return input.split(/\s*,\s*/);
    } else {
        return input;
    }
}