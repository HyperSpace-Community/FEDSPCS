// Handle different page actions
function handlePageAction(action, page) {
    switch (action) {
        case 'rename':
            const newTitle = prompt('Enter new page title:', page.querySelector('span').textContent);
            if (newTitle) {
                page.querySelector('span').textContent = newTitle;
                savePagesState();
            }
            break;

        case 'duplicate':
            const clone = page.cloneNode(true);
            clone.querySelector('span').textContent += ' (Copy)';
            page.parentNode.insertBefore(clone, page.nextSibling);
            savePagesState();
            break;

        case 'delete':
            if (confirm('Are you sure you want to delete this page?')) {
                page.remove();
                savePagesState();
            }
            break;
    }
}

// Save pages state to localStorage
function savePagesState() {
    const pages = Array.from(document.querySelectorAll('.page')).map(page => ({
        title: page.querySelector('span').textContent,
        content: page.dataset.content || ''
    }));

    localStorage.setItem('pages', JSON.stringify(pages));
}

// Load pages state from localStorage
function loadPagesState() {
    const pages = JSON.parse(localStorage.getItem('pages') || '[]');
    const pagesContainer = document.querySelector('.pages');
    const addPageButton = document.querySelector('.add-page');

    pages.forEach(pageData => {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'page';
        pageDiv.draggable = true;
        pageDiv.dataset.content = pageData.content;
        pageDiv.innerHTML = `
            <i class="fas fa-file-alt"></i>
            <span>${pageData.title}</span>
        `;
        pagesContainer.insertBefore(pageDiv, addPageButton);
    });
}