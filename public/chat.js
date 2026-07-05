document.addEventListener('DOMContentLoaded', () => {
    const chatWidget = document.getElementById('chat-widget');
    const chatToggleBtn = document.getElementById('chat-toggle-btn');
    const chatHeader = document.getElementById('chat-header');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatMessages = document.getElementById('chat-messages');

    let isCollapsed = true;
    let chatHistory = JSON.parse(localStorage.getItem('quarky_history')) || [];

    function renderHistory() {
        chatHistory.forEach(msg => appendMessage(msg.role, msg.content));
    }
    renderHistory();

    function toggleChat() {
        isCollapsed = !isCollapsed;
        if (isCollapsed) {
            chatWidget.classList.add('collapsed');
        } else {
            chatWidget.classList.remove('collapsed');
            chatInput.focus();
        }
    }

    // Create a Clear Memory Button dynamically
    const clearBtn = document.createElement('button');
    clearBtn.innerHTML = '🗑️';
    clearBtn.title = 'Xoá trí nhớ';
    clearBtn.style.background = 'none';
    clearBtn.style.border = 'none';
    clearBtn.style.cursor = 'pointer';
    clearBtn.style.fontSize = '18px';
    clearBtn.style.marginLeft = 'auto'; // push it next to toggle btn
    clearBtn.style.marginRight = '8px';
    
    // Append to the header controls container (before the toggle button)
    const headerControls = chatHeader.querySelector('.chat-header-controls') || chatHeader;
    headerControls.insertBefore(clearBtn, chatToggleBtn);

    clearBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent header toggle
        if (confirm('Bạn muốn xoá trí nhớ của Quarky nãy giờ?')) {
            chatHistory = [];
            localStorage.removeItem('quarky_history');
            chatMessages.innerHTML = '';
            appendMessage('assistant', 'Đã xoá trí nhớ! Quarky đã sẵn sàng nói Tiếng Việt trở lại! 🦆');
        }
    });

    chatToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleChat();
    });

    chatHeader.addEventListener('click', () => {
        if (isCollapsed) {
            toggleChat();
        }
    });

    function appendMessage(role, content) {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', role);
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('msg-content');
        
        // Advanced parsing for JSON image structures 
        try {
            if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
                const jsonObj = JSON.parse(content.trim());
                if (jsonObj.image || jsonObj.url) {
                    content = `![image](${jsonObj.image || jsonObj.url})`;
                }
            }
        } catch(e) {}

        // Markdown Image Parsing
        content = content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; border-radius: 8px; margin-top: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />');
        
        // Markdown links
        content = content.replace(/(^|[^!])\[([^\]]+)\]\(([^)]+)\)/g, '$1<a href="$3" target="_blank" style="color: var(--accent); text-decoration: underline;">$2</a>');

        // Simple Markdown parsing for bold, italic, and newlines
        content = content.replace(/```([\s\S]*?)```/g, '<pre style="background:var(--bg-card-alt); padding:8px; border-radius:4px; overflow-x:auto;"><code>$1</code></pre>');
        content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
        content = content.replace(/\n/g, '<br/>');

        contentDiv.innerHTML = content;
        msgDiv.appendChild(contentDiv);
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        // Display user message
        appendMessage('user', text);
        chatInput.value = '';
        chatInput.disabled = true;
        chatSendBtn.disabled = true;

        // Add to history and save
        chatHistory.push({ role: 'user', content: text });
        if (chatHistory.length > 60) chatHistory = chatHistory.slice(-60); // limit payload
        localStorage.setItem('quarky_history', JSON.stringify(chatHistory));

        // Show loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.classList.add('message', 'assistant', 'loading-msg');
        loadingDiv.innerHTML = '<div class="msg-content"><span class="typing-indicator">Quarky is thinking... 🦆</span></div>';
        chatMessages.appendChild(loadingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: chatHistory })
            });

            const data = await response.json();
            
            // Remove loading
            chatMessages.removeChild(loadingDiv);

            if (data.response) {
                appendMessage('assistant', data.response);
                chatHistory.push({ role: 'assistant', content: data.response });
                if (chatHistory.length > 60) chatHistory = chatHistory.slice(-60);
                localStorage.setItem('quarky_history', JSON.stringify(chatHistory));
            } else {
                appendMessage('assistant', 'Error connecting to brain 🦆');
            }
        } catch (err) {
            chatMessages.removeChild(loadingDiv);
            appendMessage('assistant', 'Quack! Connection failed. 🦆');
        } finally {
            chatInput.disabled = false;
            chatSendBtn.disabled = false;
            chatInput.focus();
        }
    }

    chatSendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
});
