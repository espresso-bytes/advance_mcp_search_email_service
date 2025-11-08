

import type { Message } from '../types';

/**
 * Sends a file path to the local server for ingestion.
 * @param filePath The file name of the file to be ingested.
 * @param userId The user's ID, used as tenant_id.
 * @returns A promise that resolves to the success message from the backend.
 */
export async function ingestFile(filePath: string, userId: string): Promise<string> {
    // ====================================================================================
    // IMPORTANT NOTE ON FILE INGESTION
    // ====================================================================================
    // Web browsers have strict security policies that prevent web pages from accessing a
    // user's local file system directly. This means when a user selects a file using the
    // "Browse" button, we can only get the file's name (e.g., "my_document.pdf"), NOT
    // its full local path (e.g., "C:\\Users\\YourName\\Documents\\my_document.pdf").
    //
    // This function prepends a hardcoded local path to the file name.
    //
    // REQUIRED BACKEND CONFIGURATION:
    // This assumes your files are located in "C:\\Users\\Varsha Singh\\Downloads\\".
    // Your `gemini_cli_server` should be able to access this path.
    // ====================================================================================
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes

    try {
        const fullPath = `C:\\Users\\Varsha Singh\\Downloads\\${filePath}`;
        const params = new URLSearchParams({
            file_location: fullPath,
            tenant_id: userId,
        });
        const endpoint = `http://localhost:8820/ingest?${params.toString()}`;
        
        const apiResponse = await fetch(endpoint, { 
            method: 'POST',
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        
        const responseText = await apiResponse.text();

        if (!apiResponse.ok) {
            let errorMessage = responseText || `Ingestion failed (status: ${apiResponse.status}).`;
            try {
                const errorData = JSON.parse(responseText);
                if (errorData.detail && Array.isArray(errorData.detail)) {
                    const messages = errorData.detail.map((err: any) => 
                        (err.loc && err.loc.length > 1) ? `Missing parameter: '${err.loc[1]}'` : err.msg
                    ).join('; ');
                    errorMessage = `Backend error: ${messages}`;
                } else if (errorData.detail && typeof errorData.detail === 'string') {
                    errorMessage = errorData.detail;
                }
            } catch (e) {
                // Not a JSON response, errorMessage is already set to errorText which is what we want.
            }
            console.error(`Backend server error during ingestion: ${apiResponse.status}`, responseText);
            throw new Error(errorMessage);
        }

        // Per user request, return the raw response from the server as-is.
        return responseText;

    } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof DOMException && error.name === 'AbortError') {
            throw new Error("File ingestion timed out after 3 minutes. The file may be too large or the server is busy.");
        }
        console.error("Error calling ingest API:", error);
        if (error instanceof TypeError) {
             throw new Error("Could not connect to the backend server for ingestion. Please ensure it is running on port 8820. This might also be a CORS issue if your server is not configured to accept requests from this application's origin.");
        }
        throw error;
    }
}

const sendEmailTool = {
  name: 'send_email',
  description: 'Sends an email to a specified recipient.',
  parameters: {
    type: 'OBJECT',
    properties: {
      recipient: {
        type: 'STRING',
        description: 'The email address of the recipient.',
      },
      subject: {
        type: 'STRING',
        description: 'The subject of the email.',
      },
      body: {
        type: 'STRING',
        description: 'The body content of the email.',
      },
    },
    required: ['recipient', 'subject', 'body'],
  },
};


/**
 * Generates a response by proxying to the local gemini_cli_server.
 * @param prompt The user's query.
 * @param isDocumentQuery Whether the query relates to a previously ingested document.
 * @param useWebSearch Whether to enable Google Search grounding (handled by backend).
 * @param history The previous messages in the conversation for context.
 * @param userId The user's ID, used as tenant_id for the backend.
 * @returns A promise that resolves to the raw response text from the backend.
 */
export async function generateResponse(
    prompt: string,
    isDocumentQuery: boolean,
    useWebSearch: boolean,
    history: Message[],
    userId: string
): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000);

    try {
        const tenantId = userId;

        // WORKAROUND: Reduced history length from 10 to 4.
        // The backend requires a GET request, which has URL length limitations.
        // Long conversation histories were causing the URL to exceed these limits,
        // leading to cryptic failures from the backend (e.g., responding with "rst command.").
        // This change keeps the URL length manageable, fixing the bug at the cost of
        // a shorter context window for the model.
        const MAX_HISTORY_MESSAGES = 4;
        const truncatedHistory = history.length > MAX_HISTORY_MESSAGES 
            ? history.slice(-MAX_HISTORY_MESSAGES) 
            : history;

        const mappedHistory = truncatedHistory.map(msg => ({
            role: msg.sender === 'ai' ? 'model' : 'user',
            parts: [{ text: msg.text }]
        }));

        // FIX: Reverted from POST to GET. The backend server expects a GET request for the
        // /prompt endpoint, and using POST was causing a "405 Method Not Allowed" error. All
        // parameters are now sent in the query string as the server expects.
        const params = new URLSearchParams();
        params.append('prompt', prompt);
        params.append('tenant_id', tenantId);
        params.append('use_web_search', String(useWebSearch));
        params.append('is_document_query', String(isDocumentQuery));
        params.append('history', JSON.stringify(mappedHistory));
        params.append('tools', JSON.stringify([sendEmailTool]));

        const endpoint = `http://localhost:8820/prompt?${params.toString()}`;
        
        const apiResponse = await fetch(endpoint, {
            method: 'GET',
            signal: controller.signal,
        });

        const responseText = await apiResponse.text();
        clearTimeout(timeoutId);

        if (!apiResponse.ok) {
            let errorMessage = responseText || `The backend server responded with an error (status: ${apiResponse.status}).`;
            try {
                const errorData = JSON.parse(responseText);
                if (errorData.detail && Array.isArray(errorData.detail)) {
                    const messages = errorData.detail.map((err: any) => 
                        (err.loc && err.loc.length > 1) ? `Missing parameter: '${err.loc[1]}'` : err.msg
                    ).join('; ');
                    errorMessage = `Backend error: ${messages}`;
                } else if (errorData.detail && typeof errorData.detail === 'string') {
                    errorMessage = errorData.detail;
                }
            } catch (e) {
                // Not a JSON response, errorMessage is already set to errorText which is what we want.
            }
            console.error(`Backend server error: ${apiResponse.status}`, responseText);
            throw new Error(errorMessage);
        }

        // Per user request, always return the raw text response. The calling component
        // is responsible for parsing it based on the context (e.g., web search vs. document query).
        return responseText;

    } catch (error) {
        clearTimeout(timeoutId); // Always clear the timeout on any error.
        if (error instanceof DOMException && error.name === 'AbortError') {
            throw new Error("The request to the backend timed out after 3 minutes. The server might be busy or unresponsive.");
        }
        if (error instanceof TypeError) {
            throw new Error("Could not connect to the backend server. Please ensure it is running on port 8820. This might also be a CORS issue if your server is not configured to accept requests from this application's origin.");
        }
        throw error;
    }
}
