// Store pages content in memory
let pages = {
    'welcome': {
        name: 'Welcome Page',
        content: document.querySelector('.editor').innerHTML
    }
};

let currentPageId = 'welcome';

// Format text functions
function formatText(command) {
    document.execCommand(command, false, null);
    updateToolbarState();
    focusEditor();
}

function addHeading() {
    document.execCommand('formatBlock', false, '<h2>');
    updateToolbarState();
    focusEditor();
}

function addList(type) {
    if (type === 'bullet') {
        document.execCommand('insertUnorderedList', false, null);
    } else {
        document.execCommand('insertOrderedList', false, null);
    }
    updateToolbarState();
    focusEditor();
}

function addCodeBlock() {
    const language = prompt('Enter programming language (e.g., javascript, python, html):', 'javascript');
    if (language) {
        const pre = document.createElement('pre');
        pre.className = 'line-numbers';
        const code = document.createElement('code');
        code.className = `language-${language}`;
        code.textContent = '// Your code here';
        pre.appendChild(code);
        insertAtCursor(pre);
        Prism.highlightElement(code);
    }
    updateToolbarState();
    focusEditor();
}

function insertTable() {
    const rows = prompt('Enter number of rows:', '3');
    const cols = prompt('Enter number of columns:', '3');
    
    if (rows && cols) {
        const table = document.createElement('table');
        table.style.border = '1px solid #ddd';
        table.style.borderCollapse = 'collapse';
        
        // Create header row
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        for (let i = 0; i < cols; i++) {
            const th = document.createElement('th');
            th.textContent = `Header ${i + 1}`;
            th.style.border = '1px solid #ddd';
            th.style.padding = '8px';
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create body rows
        const tbody = document.createElement('tbody');
        for (let i = 0; i < rows - 1; i++) {
            const row = document.createElement('tr');
            for (let j = 0; j < cols; j++) {
                const td = document.createElement('td');
                td.textContent = 'Cell';
                td.style.border = '1px solid #ddd';
                td.style.padding = '8px';
                row.appendChild(td);
            }
            tbody.appendChild(row);
        }
        table.appendChild(tbody);
        
        insertAtCursor(table);
    }
}

function triggerImageUpload() {
    document.getElementById('imageUpload').click();
}

// Handle image upload
document.getElementById('imageUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = document.createElement('img');
            img.src = event.target.result;
            img.style.maxWidth = '100%';
            insertAtCursor(img);
        };
        reader.readAsDataURL(file);
    }
});

function addLink() {
    const url = prompt('Enter URL:', 'https://');
    if (url) {
        document.execCommand('createLink', false, url);
    }
    updateToolbarState();
    focusEditor();
}

function insertAtCursor(element) {
    const selection = window.getSelection();
    if (selection.rangeCount) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(element);
    }
}

function focusEditor() {
    const editor = document.querySelector('.editor');
    editor.focus();
}

// Update toolbar state based on current selection
function updateToolbarState() {
    const commands = {
        'bold': 'bold',
        'italic': 'italic',
        'underline': 'underline'
    };

    Object.entries(commands).forEach(([className, command]) => {
        const button = document.querySelector(`button[onclick="formatText('${command}')"]`);
        if (button) {
            button.classList.toggle('active', document.queryCommandState(command));
        }
    });

    // Check for lists
    const bulletButton = document.querySelector('button[onclick="addList(\'bullet\')"]');
    const numberButton = document.querySelector('button[onclick="addList(\'number\')"]');
    
    if (bulletButton) {
        bulletButton.classList.toggle('active', document.queryCommandState('insertUnorderedList'));
    }
    if (numberButton) {
        numberButton.classList.toggle('active', document.queryCommandState('insertOrderedList'));
    }

    // Check for headings
    const headingButton = document.querySelector('button[onclick="addHeading()"]');
    if (headingButton) {
        const formatBlock = document.queryCommandValue('formatBlock');
        headingButton.classList.toggle('active', /^h[1-6]$/i.test(formatBlock));
    }
}

// Search functionality
const searchInput = document.getElementById('pageSearch');
const searchOptions = document.getElementById('searchOptions');
const searchFilters = document.querySelector('.search-filters');
const searchResults = document.getElementById('searchResults');
const pagesContainer = document.querySelector('.pages');

let searchTimeout = null;

// Toggle search options
searchOptions.addEventListener('click', () => {
    searchFilters.style.display = searchFilters.style.display === 'none' ? 'block' : 'none';
});

// Search event handler
searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(performSearch, 300);
});

function performSearch() {
    const query = searchInput.value.trim();
    const searchTitles = document.getElementById('searchTitles').checked;
    const searchContent = document.getElementById('searchContent').checked;
    const caseSensitive = document.getElementById('caseSensitive').checked;
    const wholeWord = document.getElementById('wholeWord').checked;

    if (!query) {
        searchResults.innerHTML = '';
        pagesContainer.classList.remove('search-active');
        return;
    }

    pagesContainer.classList.add('search-active');
    const results = [];

    Object.entries(pages).forEach(([pageId, pageData]) => {
        let matched = false;
        let titleMatch = null;
        let contentMatches = [];

        const searchInText = (text) => {
            if (!caseSensitive) {
                text = text.toLowerCase();
                query = query.toLowerCase();
            }

            if (wholeWord) {
                const words = text.split(/\b/);
                return words.includes(query);
            }

            return text.includes(query);
        };

        // Search in title
        if (searchTitles && searchInText(pageData.name)) {
            matched = true;
            titleMatch = highlightText(pageData.name, query, caseSensitive);
        }

        // Search in content
        if (searchContent) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = pageData.content;
            const textContent = tempDiv.textContent;

            if (searchInText(textContent)) {
                matched = true;
                // Find the context around matches
                const matches = findMatchContext(textContent, query, caseSensitive, wholeWord);
                contentMatches = matches.map(context => highlightText(context, query, caseSensitive));
            }
        }

        if (matched) {
            results.push({
                pageId,
                title: titleMatch || pageData.name,
                matches: contentMatches
            });
        }
    });

    displaySearchResults(results);
}

function findMatchContext(text, query, caseSensitive, wholeWord) {
    const contexts = [];
    let searchText = caseSensitive ? text : text.toLowerCase();
    let searchQuery = caseSensitive ? query : query.toLowerCase();

    let lastIndex = 0;
    while (true) {
        let index = searchText.indexOf(searchQuery, lastIndex);
        if (index === -1) break;

        if (wholeWord) {
            const before = index === 0 || /\W/.test(searchText[index - 1]);
            const after = index + searchQuery.length === searchText.length || 
                         /\W/.test(searchText[index + searchQuery.length]);
            if (!before || !after) {
                lastIndex = index + 1;
                continue;
            }
        }

        // Get context (50 chars before and after)
        const start = Math.max(0, index - 50);
        const end = Math.min(text.length, index + searchQuery.length + 50);
        let context = text.slice(start, end);

        // Add ellipsis if needed
        if (start > 0) context = '...' + context;
        if (end < text.length) context += '...';

        contexts.push(context);
        lastIndex = index + 1;

        // Limit to 3 contexts per page
        if (contexts.length >= 3) break;
    }

    return contexts;
}

function highlightText(text, query, caseSensitive) {
    if (!caseSensitive) {
        const regex = new RegExp(query, 'gi');
        return text.replace(regex, match => `<span class="search-highlight">${match}</span>`);
    }
    return text.replace(new RegExp(query, 'g'), 
        match => `<span class="search-highlight">${match}</span>`);
}

function displaySearchResults(results) {
    if (results.length === 0) {
        searchResults.innerHTML = '<div class="search-result-item">No results found</div>';
        return;
    }

    searchResults.innerHTML = results.map(result => `
        <div class="search-result-item" data-page-id="${result.pageId}">
            <div class="search-result-title">${result.title}</div>
            ${result.matches.map(match => 
                `<div class="search-result-content">${match}</div>`
            ).join('')}
        </div>
    `).join('');

    // Add click handlers to results
    searchResults.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
            const pageId = item.getAttribute('data-page-id');
            switchPage(pageId);
            searchInput.value = '';
            searchResults.innerHTML = '';
            pagesContainer.classList.remove('search-active');
        });
    });
}

// Page search functionality
document.getElementById('pageSearch').addEventListener('input', function(e) {
    const searchTerm = e.target.value.toLowerCase();
    document.querySelectorAll('.page').forEach(page => {
        const pageName = page.querySelector('span').textContent.toLowerCase();
        if (pageName.includes(searchTerm)) {
            page.style.display = 'flex';
        } else {
            page.style.display = 'none';
        }
    });
});

// Page management
function addNewPage() {
    const pageId = `page_${Date.now()}`;
    const pageName = `New Page ${Object.keys(pages).length}`;
    
    pages[pageId] = {
        name: pageName,
        content: '<h1>New Page</h1><p>Start typing here...</p>'
    };
    
    const pageElement = document.createElement('div');
    pageElement.className = 'page';
    pageElement.setAttribute('data-id', pageId);
    pageElement.innerHTML = `
        <i class="fas fa-file"></i>
        <span>${pageName}</span>
        <div class="page-actions">
            <i class="fas fa-edit" title="Rename"></i>
            <i class="fas fa-trash" title="Delete"></i>
        </div>
    `;
    
    const addPageButton = document.querySelector('.add-page');
    addPageButton.parentNode.insertBefore(pageElement, addPageButton);
    
    initializePageEvents(pageElement);
    switchPage(pageId);
    saveToLocalStorage();
}

function initializePageEvents(pageElement) {
    pageElement.addEventListener('click', (e) => {
        if (e.target.classList.contains('fa-trash')) {
            deletePage(pageElement);
        } else if (e.target.classList.contains('fa-edit')) {
            renamePage(pageElement);
        } else {
            const pageId = pageElement.getAttribute('data-id');
            switchPage(pageId);
        }
    });
}

function deletePage(pageElement) {
    const pageId = pageElement.getAttribute('data-id');
    if (pageId === 'welcome') {
        alert('Cannot delete the welcome page!');
        return;
    }
    
    if (confirm('Are you sure you want to delete this page?')) {
        delete pages[pageId];
        pageElement.remove();
        if (currentPageId === pageId) {
            switchPage('welcome');
        }
        saveToLocalStorage();
    }
}

function renamePage(pageElement) {
    const pageId = pageElement.getAttribute('data-id');
    if (pageId === 'welcome') {
        alert('Cannot rename the welcome page!');
        return;
    }
    
    const span = pageElement.querySelector('span');
    const currentName = span.textContent;
    const newName = prompt('Enter new page name:', currentName);
    
    if (newName && newName.trim() !== '') {
        span.textContent = newName;
        pages[pageId].name = newName;
        saveToLocalStorage();
    }
}

function switchPage(pageId) {
    // Save current page content
    const editor = document.querySelector('.editor');
    pages[currentPageId].content = editor.innerHTML;
    
    // Update active page styling
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.querySelector(`[data-id="${pageId}"]`).classList.add('active');
    
    // Load new page content
    editor.innerHTML = pages[pageId].content;
    currentPageId = pageId;
    focusEditor();
    saveToLocalStorage();
}

// Auto-save functionality
let autoSaveTimeout;

function autoSave() {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
        localStorage.setItem('editorContent', editor.innerHTML);
        showToast('Content auto-saved');
    }, 2000);
}

// Restore content on page load
document.addEventListener('DOMContentLoaded', () => {
    const savedContent = localStorage.getItem('editorContent');
    if (savedContent) {
        editor.innerHTML = savedContent;
    }
});

// Word and character counter
function updateStats() {
    const text = editor.innerText;
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    const chars = text.length;

    document.getElementById('wordCount').textContent = `Words: ${words.length}`;
    document.getElementById('charCount').textContent = `Characters: ${chars}`;
}

editor.addEventListener('input', () => {
    autoSave();
    updateStats();
});

// Search and replace functionality
function toggleSearchPanel() {
    const panel = document.querySelector('.search-replace-panel');
    panel.classList.toggle('active');
    if (panel.classList.contains('active')) {
        document.getElementById('searchInput').focus();
    }
}

function findNext() {
    const searchText = document.getElementById('searchInput').value;
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const content = editor.innerText;
    const startPos = range.endOffset;
    
    const foundPos = content.indexOf(searchText, startPos);
    if (foundPos !== -1) {
        const newRange = document.createRange();
        newRange.setStart(editor.firstChild, foundPos);
        newRange.setEnd(editor.firstChild, foundPos + searchText.length);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }
}

function replace() {
    const searchText = document.getElementById('searchInput').value;
    const replaceText = document.getElementById('replaceInput').value;
    const selection = window.getSelection();
    
    if (selection.toString() === searchText) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(replaceText));
        findNext();
    }
}

function replaceAll() {
    const searchText = document.getElementById('searchInput').value;
    const replaceText = document.getElementById('replaceInput').value;
    editor.innerHTML = editor.innerHTML.replaceAll(searchText, replaceText);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey) {
        switch (e.key.toLowerCase()) {
            case 's':
                e.preventDefault();
                autoSave();
                break;
            case 'f':
                e.preventDefault();
                toggleSearchPanel();
                break;
            case '/':
                e.preventDefault();
                toggleShortcutsPanel();
                break;
        }
    }
});

function toggleShortcutsPanel() {
    const panel = document.querySelector('.keyboard-shortcuts');
    panel.classList.toggle('active');
}

// Toast notification
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Auto-save functionality
const editor = document.querySelector('.editor');
editor.addEventListener('input', () => {
    if (currentPageId && pages[currentPageId]) {
        pages[currentPageId].content = editor.innerHTML;
        saveToLocalStorage();
    }
});

// Local storage functions
function saveToLocalStorage() {
    localStorage.setItem('futurED_pages', JSON.stringify(pages));
    localStorage.setItem('futurED_currentPage', currentPageId);
}

function loadFromLocalStorage() {
    const savedPages = localStorage.getItem('futurED_pages');
    const savedCurrentPage = localStorage.getItem('futurED_currentPage');
    
    if (savedPages) {
        pages = JSON.parse(savedPages);
        
        // Recreate page elements
        const pagesContainer = document.querySelector('.pages');
        const addPageButton = pagesContainer.querySelector('.add-page');
        
        Object.entries(pages).forEach(([pageId, pageData]) => {
            if (document.querySelector(`[data-id="${pageId}"]`)) return;
            
            const pageElement = document.createElement('div');
            pageElement.className = 'page';
            pageElement.setAttribute('data-id', pageId);
            pageElement.innerHTML = `
                <i class="fas fa-file"></i>
                <span>${pageData.name}</span>
                <div class="page-actions">
                    <i class="fas fa-edit" title="Rename"></i>
                    <i class="fas fa-trash" title="Delete"></i>
                </div>
            `;
            
            pagesContainer.insertBefore(pageElement, addPageButton);
            initializePageEvents(pageElement);
        });
        
        if (savedCurrentPage && pages[savedCurrentPage]) {
            switchPage(savedCurrentPage);
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Initialize page events
    document.querySelectorAll('.page').forEach(initializePageEvents);
    
    // Load saved data
    loadFromLocalStorage();
    
    // Focus editor
    focusEditor();

    // Add selection change listener for toolbar state
    document.addEventListener('selectionchange', updateToolbarState);
    
    // Add input listener for toolbar state
    editor.addEventListener('input', updateToolbarState);
});

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key.toLowerCase()) {
            case 'b':
                e.preventDefault();
                formatText('bold');
                break;
            case 'i':
                e.preventDefault();
                formatText('italic');
                break;
            case 'u':
                e.preventDefault();
                formatText('underline');
                break;
        }
    }
});

// Task and Note Management
let categories = {
    tasks: ['Work', 'Personal', 'Shopping', 'Ideas'],
    notes: ['General', 'Meeting Notes', 'Project Ideas', 'Resources']
};

function initializeTasksPage() {
    const editor = document.querySelector('.editor');
    editor.innerHTML = `
        <div class="page-header">
            <h1>Tasks</h1>
            <button class="add-task-btn" onclick="showAddTaskDialog()">
                <i class="fas fa-plus"></i> Add Task
            </button>
        </div>
        <div class="category-list">
            ${categories.tasks.map(category => `
                <div class="category-header">
                    <div class="category-title">${category}</div>
                    <div class="category-count">0</div>
                </div>
                <div class="task-list" data-category="${category}"></div>
            `).join('')}
        </div>
    `;
    loadTasks();
}

function initializeNotesPage() {
    const editor = document.querySelector('.editor');
    editor.innerHTML = `
        <div class="page-header">
            <h1>My Notes</h1>
            <button class="add-note-btn" onclick="showAddNoteDialog()">
                <i class="fas fa-plus"></i> Add Note
            </button>
        </div>
        <div class="notes-container">
            ${categories.notes.map(category => `
                <div class="category-list">
                    <div class="category-header">
                        <div class="category-title">${category}</div>
                        <div class="category-count">0</div>
                    </div>
                    <div class="notes-list" data-category="${category}"></div>
                </div>
            `).join('')}
        </div>
    `;
    loadNotes();
}

function createTask(taskData) {
    const template = document.getElementById('taskTemplate');
    const taskElement = template.content.cloneNode(true);
    const taskItem = taskElement.querySelector('.task-item');
    
    taskItem.querySelector('.task-title').textContent = taskData.title;
    
    if (taskData.dueDate) {
        taskItem.querySelector('.task-due-date').innerHTML = `
            <i class="far fa-calendar"></i> ${taskData.dueDate}
        `;
    }
    
    if (taskData.priority) {
        taskItem.querySelector('.task-priority').innerHTML = `
            <i class="fas fa-flag"></i> ${taskData.priority}
        `;
        taskItem.querySelector('.task-priority').classList.add(taskData.priority.toLowerCase());
    }
    
    if (taskData.category) {
        taskItem.querySelector('.task-category').innerHTML = `
            <i class="fas fa-folder"></i> ${taskData.category}
        `;
    }
    
    taskItem.querySelector('input[type="checkbox"]').checked = taskData.completed || false;
    
    // Add event listeners
    taskItem.querySelector('.task-checkbox input').addEventListener('change', (e) => {
        taskData.completed = e.target.checked;
        saveTasks();
    });
    
    taskItem.querySelector('.task-edit').addEventListener('click', () => {
        editTask(taskData, taskItem);
    });
    
    taskItem.querySelector('.task-delete').addEventListener('click', () => {
        if (confirm('Are you sure you want to delete this task?')) {
            taskItem.remove();
            saveTasks();
        }
    });
    
    return taskItem;
}

function createNote(noteData) {
    const template = document.getElementById('noteTemplate');
    const noteElement = template.content.cloneNode(true);
    const noteItem = noteElement.querySelector('.note-item');
    
    noteItem.querySelector('.note-title').textContent = noteData.title;
    noteItem.querySelector('.note-content').textContent = noteData.content;
    noteItem.querySelector('.note-category').textContent = noteData.category;
    noteItem.querySelector('.note-date').textContent = noteData.date || new Date().toLocaleDateString();
    
    if (noteData.tags) {
        const tagsContainer = noteItem.querySelector('.note-tags');
        noteData.tags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.className = 'note-tag';
            tagElement.textContent = tag;
            tagsContainer.appendChild(tagElement);
        });
    }
    
    // Add event listeners
    noteItem.querySelector('.note-edit').addEventListener('click', () => {
        editNote(noteData, noteItem);
    });
    
    noteItem.querySelector('.note-delete').addEventListener('click', () => {
        if (confirm('Are you sure you want to delete this note?')) {
            noteItem.remove();
            saveNotes();
        }
    });
    
    return noteItem;
}

function showAddTaskDialog() {
    const taskData = {
        title: '',
        dueDate: '',
        priority: 'Medium',
        category: categories.tasks[0]
    };
    
    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog';
    dialog.innerHTML = `
        <div class="modal-content">
            <h2>Add New Task</h2>
            <input type="text" placeholder="Task title" class="task-title-input">
            <input type="date" class="task-due-date-input">
            <select class="task-priority-select">
                <option value="High">High Priority</option>
                <option value="Medium" selected>Medium Priority</option>
                <option value="Low">Low Priority</option>
            </select>
            <select class="task-category-select">
                ${categories.tasks.map(cat => 
                    `<option value="${cat}">${cat}</option>`
                ).join('')}
            </select>
            <div class="modal-actions">
                <button class="cancel-btn">Cancel</button>
                <button class="save-btn">Add Task</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    dialog.querySelector('.cancel-btn').addEventListener('click', () => {
        dialog.remove();
    });
    
    dialog.querySelector('.save-btn').addEventListener('click', () => {
        taskData.title = dialog.querySelector('.task-title-input').value;
        taskData.dueDate = dialog.querySelector('.task-due-date-input').value;
        taskData.priority = dialog.querySelector('.task-priority-select').value;
        taskData.category = dialog.querySelector('.task-category-select').value;
        
        if (taskData.title) {
            const taskItem = createTask(taskData);
            const taskList = document.querySelector(`.task-list[data-category="${taskData.category}"]`);
            taskList.appendChild(taskItem);
            saveTasks();
            dialog.remove();
        }
    });
}

function showAddNoteDialog() {
    const noteData = {
        title: '',
        content: '',
        category: categories.notes[0],
        tags: []
    };
    
    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog';
    dialog.innerHTML = `
        <div class="modal-content">
            <h2>Add New Note</h2>
            <input type="text" placeholder="Note title" class="note-title-input">
            <textarea placeholder="Note content" class="note-content-input"></textarea>
            <select class="note-category-select">
                ${categories.notes.map(cat => 
                    `<option value="${cat}">${cat}</option>`
                ).join('')}
            </select>
            <input type="text" placeholder="Add tags (comma separated)" class="note-tags-input">
            <div class="modal-actions">
                <button class="cancel-btn">Cancel</button>
                <button class="save-btn">Add Note</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    dialog.querySelector('.cancel-btn').addEventListener('click', () => {
        dialog.remove();
    });
    
    dialog.querySelector('.save-btn').addEventListener('click', () => {
        noteData.title = dialog.querySelector('.note-title-input').value;
        noteData.content = dialog.querySelector('.note-content-input').value;
        noteData.category = dialog.querySelector('.note-category-select').value;
        noteData.tags = dialog.querySelector('.note-tags-input').value
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag);
        
        if (noteData.title && noteData.content) {
            const noteItem = createNote(noteData);
            const notesList = document.querySelector(`.notes-list[data-category="${noteData.category}"]`);
            notesList.appendChild(noteItem);
            saveNotes();
            dialog.remove();
        }
    });
}

function editTask(taskData, taskItem) {
    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog';
    dialog.innerHTML = `
        <div class="modal-content">
            <h2>Edit Task</h2>
            <input type="text" placeholder="Task title" class="task-title-input" value="${taskData.title}">
            <input type="date" class="task-due-date-input" value="${taskData.dueDate}">
            <select class="task-priority-select">
                <option value="High" ${taskData.priority === 'High' ? 'selected' : ''}>High Priority</option>
                <option value="Medium" ${taskData.priority === 'Medium' ? 'selected' : ''}>Medium Priority</option>
                <option value="Low" ${taskData.priority === 'Low' ? 'selected' : ''}>Low Priority</option>
            </select>
            <select class="task-category-select">
                ${categories.tasks.map(cat => 
                    `<option value="${cat}" ${taskData.category === cat ? 'selected' : ''}>${cat}</option>`
                ).join('')}
            </select>
            <div class="modal-actions">
                <button class="cancel-btn">Cancel</button>
                <button class="save-btn">Save Changes</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    dialog.querySelector('.cancel-btn').addEventListener('click', () => {
        dialog.remove();
    });
    
    dialog.querySelector('.save-btn').addEventListener('click', () => {
        const newTitle = dialog.querySelector('.task-title-input').value;
        const newDueDate = dialog.querySelector('.task-due-date-input').value;
        const newPriority = dialog.querySelector('.task-priority-select').value;
        const newCategory = dialog.querySelector('.task-category-select').value;
        
        if (newTitle) {
            taskItem.querySelector('.task-title').textContent = newTitle;
            taskItem.querySelector('.task-due-date').innerHTML = `
                <i class="far fa-calendar"></i> ${newDueDate}
            `;
            taskItem.querySelector('.task-priority').innerHTML = `
                <i class="fas fa-flag"></i> ${newPriority}
            `;
            taskItem.querySelector('.task-priority').className = 'task-priority ' + newPriority.toLowerCase();
            taskItem.querySelector('.task-category').innerHTML = `
                <i class="fas fa-folder"></i> ${newCategory}
            `;
            
            if (taskData.category !== newCategory) {
                const newList = document.querySelector(`.task-list[data-category="${newCategory}"]`);
                newList.appendChild(taskItem);
            }
            
            saveTasks();
            dialog.remove();
        }
    });
}

function editNote(noteData, noteItem) {
    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog';
    dialog.innerHTML = `
        <div class="modal-content">
            <h2>Edit Note</h2>
            <input type="text" placeholder="Note title" class="note-title-input" value="${noteData.title}">
            <textarea placeholder="Note content" class="note-content-input">${noteData.content}</textarea>
            <select class="note-category-select">
                ${categories.notes.map(cat => 
                    `<option value="${cat}" ${noteData.category === cat ? 'selected' : ''}>${cat}</option>`
                ).join('')}
            </select>
            <input type="text" placeholder="Add tags (comma separated)" class="note-tags-input" 
                value="${noteData.tags ? noteData.tags.join(', ') : ''}">
            <div class="modal-actions">
                <button class="cancel-btn">Cancel</button>
                <button class="save-btn">Save Changes</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    dialog.querySelector('.cancel-btn').addEventListener('click', () => {
        dialog.remove();
    });
    
    dialog.querySelector('.save-btn').addEventListener('click', () => {
        const newTitle = dialog.querySelector('.note-title-input').value;
        const newContent = dialog.querySelector('.note-content-input').value;
        const newCategory = dialog.querySelector('.note-category-select').value;
        const newTags = dialog.querySelector('.note-tags-input').value
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag);
        
        if (newTitle && newContent) {
            noteItem.querySelector('.note-title').textContent = newTitle;
            noteItem.querySelector('.note-content').textContent = newContent;
            noteItem.querySelector('.note-category').textContent = newCategory;
            
            const tagsContainer = noteItem.querySelector('.note-tags');
            tagsContainer.innerHTML = '';
            newTags.forEach(tag => {
                const tagElement = document.createElement('span');
                tagElement.className = 'note-tag';
                tagElement.textContent = tag;
                tagsContainer.appendChild(tagElement);
            });
            
            if (noteData.category !== newCategory) {
                const newList = document.querySelector(`.notes-list[data-category="${newCategory}"]`);
                newList.appendChild(noteItem);
            }
            
            saveNotes();
            dialog.remove();
        }
    });
}

// Fix task saving
function saveTasks() {
    const tasks = [];
    document.querySelectorAll('.task-item').forEach(taskItem => {
        const dueDate = taskItem.querySelector('.task-due-date');
        const priority = taskItem.querySelector('.task-priority');
        const category = taskItem.querySelector('.task-category');
        
        tasks.push({
            title: taskItem.querySelector('.task-title').textContent,
            completed: taskItem.querySelector('input[type="checkbox"]').checked,
            dueDate: dueDate ? dueDate.textContent.replace(/[^0-9-]/g, '').trim() : '',
            priority: priority ? priority.textContent.replace(/[^a-zA-Z]/g, '').trim() : 'Medium',
            category: category ? category.textContent.replace(/[^a-zA-Z]/g, '').trim() : categories.tasks[0]
        });
    });
    localStorage.setItem('tasks', JSON.stringify(tasks));
    updateTaskCounts();
}

// Fix note saving
function saveNotes() {
    const notes = [];
    document.querySelectorAll('.note-item').forEach(noteItem => {
        const title = noteItem.querySelector('.note-title');
        const content = noteItem.querySelector('.note-content');
        const category = noteItem.querySelector('.note-category');
        const date = noteItem.querySelector('.note-date');
        const tags = noteItem.querySelectorAll('.note-tag');
        
        if (title && content) {
            notes.push({
                title: title.textContent,
                content: content.textContent,
                category: category ? category.textContent : categories.notes[0],
                date: date ? date.textContent : new Date().toLocaleDateString(),
                tags: Array.from(tags).map(tag => tag.textContent)
            });
        }
    });
    localStorage.setItem('notes', JSON.stringify(notes));
    updateNoteCounts();
}

function loadTasks() {
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    tasks.forEach(taskData => {
        const taskItem = createTask(taskData);
        const taskList = document.querySelector(`.task-list[data-category="${taskData.category}"]`);
        if (taskList) {
            taskList.appendChild(taskItem);
        }
    });
    updateTaskCounts();
}

function loadNotes() {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    notes.forEach(noteData => {
        const noteItem = createNote(noteData);
        const notesList = document.querySelector(`.notes-list[data-category="${noteData.category}"]`);
        if (notesList) {
            notesList.appendChild(noteItem);
        }
    });
    updateNoteCounts();
}

function updateTaskCounts() {
    categories.tasks.forEach(category => {
        const count = document.querySelector(`.task-list[data-category="${category}"]`)
            .querySelectorAll('.task-item').length;
        document.querySelector(`.category-header:has(+ .task-list[data-category="${category}"]) .category-count`)
            .textContent = count;
    });
}

function updateNoteCounts() {
    categories.notes.forEach(category => {
        const count = document.querySelector(`.notes-list[data-category="${category}"]`)
            .querySelectorAll('.note-item').length;
        document.querySelector(`.category-header:has(+ .notes-list[data-category="${category}"]) .category-count`)
            .textContent = count;
    });
}

// Initialize pages when switching
document.querySelector('[data-id="tasks"]').addEventListener('click', () => {
    initializeTasksPage();
});

document.querySelector('[data-id="notes"]').addEventListener('click', () => {
    initializeNotesPage();
});