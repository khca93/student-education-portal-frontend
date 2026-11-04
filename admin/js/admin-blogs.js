// Dashboard blog list and comment moderation. Writing happens in blog-editor.html.
(() => {
    const apiBase = () => window.API_BASE;
    const byId = (id) => document.getElementById(id);
    const token = () => localStorage.getItem('adminToken');

    async function loadBlogs() {
        const container = byId('blogsList');
        if (!container) return;
        if (!token()) { container.textContent = 'Admin session missing. Sign in again.'; return; }
        container.textContent = 'Loading articles…';
        loadPendingComments();
        try {
            const response = await fetch(`${apiBase()}/api/blogs/admin/all`, { headers: { Authorization: `Bearer ${token()}` } });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || 'Could not load articles');
            renderBlogList(data.blogs || []);
        } catch (error) {
            container.textContent = error.message || 'Failed to load articles.';
        }
    }

    // Visitor comments: built with textContent only, never innerHTML.
    async function loadPendingComments() {
        const container = byId('pendingComments');
        if (!container) return;
        container.textContent = 'Loading comments…';
        try {
            const response = await fetch(`${apiBase()}/api/blogs/admin/comments`, { headers: { Authorization: `Bearer ${token()}` } });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || 'Could not load comments');
            container.replaceChildren();
            if (!data.comments.length) { container.textContent = 'No comments waiting.'; return; }
            data.comments.forEach((comment) => {
                const item = document.createElement('div');
                item.style.cssText = 'background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;margin-bottom:10px';
                const head = document.createElement('strong'); head.textContent = `${comment.name} on “${comment.blogTitle}”`;
                const date = document.createElement('small'); date.textContent = ' ' + new Date(comment.createdAt).toLocaleString('en-IN');
                const text = document.createElement('p'); text.textContent = comment.message; text.style.cssText = 'margin:6px 0 10px;white-space:pre-line';
                const approve = document.createElement('button'); approve.type = 'button'; approve.className = 'btn btn-edit'; approve.textContent = 'Approve';
                approve.addEventListener('click', () => moderateComment(comment, 'PUT', '/approve'));
                const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn btn-delete'; remove.textContent = 'Delete';
                remove.addEventListener('click', () => confirm('Delete this comment?') && moderateComment(comment, 'DELETE', ''));
                item.append(head, date, text, approve, ' ', remove);
                container.appendChild(item);
            });
        } catch (error) {
            container.textContent = error.message || 'Failed to load comments.';
        }
    }

    async function moderateComment(comment, method, suffix) {
        try {
            const url = `${apiBase()}/api/blogs/admin/comments/${encodeURIComponent(comment.blogId)}/${encodeURIComponent(comment._id)}${suffix}`;
            const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token()}` } });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || 'Action failed');
            showAlert(method === 'PUT' ? 'Comment approved.' : 'Comment deleted.', 'success');
            loadPendingComments();
        } catch (error) { showAlert(error.message || 'Action failed.', 'error'); }
    }

    function renderBlogList(blogs) {
        const container = byId('blogsList');
        container.replaceChildren();
        if (!blogs.length) { container.textContent = 'No articles yet. Start a new article to create a draft.'; return; }
        const tableWrap = document.createElement('div');
        tableWrap.className = 'papers-table-container';
        const table = document.createElement('table');
        table.className = 'papers-table';
        const head = table.createTHead().insertRow();
        ['Title', 'Category', 'Status', 'Featured', 'Updated', 'Actions'].forEach((label) => {
            const cell = document.createElement('th'); cell.textContent = label; head.appendChild(cell);
        });
        const body = table.createTBody();
        blogs.forEach((blog) => {
            const isPublished = !blog.status || blog.status === 'published';
            const isScheduled = isPublished && blog.publishedAt && new Date(blog.publishedAt) > new Date();
            const row = body.insertRow();
            const title = row.insertCell(); title.textContent = blog.title || 'Untitled';
            row.insertCell().textContent = blog.category || 'General';
            const badge = document.createElement('span'); badge.className = `blog-status-badge ${isScheduled ? 'is-scheduled' : isPublished ? 'is-published' : 'is-draft'}`; badge.textContent = isScheduled ? `Scheduled · ${new Date(blog.publishedAt).toLocaleDateString('en-IN')}` : isPublished ? 'Published' : 'Draft'; row.insertCell().appendChild(badge);
            row.insertCell().textContent = blog.featured ? 'Yes' : 'No';
            row.insertCell().textContent = new Date(blog.updatedAt || blog.createdAt).toLocaleDateString('en-IN');
            const actions = row.insertCell(); actions.className = 'blog-list-actions';
            const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'btn btn-edit'; edit.textContent = 'Edit'; edit.addEventListener('click', () => openEditBlog(blog._id)); actions.appendChild(edit);
            if (isPublished && !isScheduled) {
                const view = document.createElement('a'); view.className = 'btn btn-view'; view.textContent = 'View'; view.href = `../blog.html?slug=${encodeURIComponent(blog.slug)}`; view.target = '_blank'; view.rel = 'noopener'; actions.appendChild(view);
            }
            const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn btn-delete'; remove.textContent = 'Delete'; remove.addEventListener('click', () => deleteBlog(blog._id, blog.title || 'Untitled')); actions.appendChild(remove);
        });
        tableWrap.appendChild(table); container.appendChild(tableWrap);
    }

    const newBlog = () => { window.location.href = 'blog-editor.html'; };
    const openEditBlog = (blogId) => { window.location.href = `blog-editor.html?id=${encodeURIComponent(blogId)}`; };

    async function deleteBlog(blogId, title) {
        if (!confirm(`Delete “${title}”? This cannot be undone.`)) return;
            try {
                const response = await fetch(`${apiBase()}/api/blogs/${encodeURIComponent(blogId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
                const data = await response.json();
                if (!response.ok || !data.success) throw new Error(data.message || 'Delete failed');
                showAlert('Article deleted.', 'success'); loadBlogs();
            } catch (error) { showAlert(error.message || 'Delete failed.', 'error'); }
    }

    window.loadBlogs = loadBlogs;
    window.forceLoadBlogs = loadBlogs;
    window.newBlog = newBlog;
    window.openEditBlog = openEditBlog;
    window.deleteBlog = deleteBlog;
})();
