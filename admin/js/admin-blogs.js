(() => {
    const apiBase = () => window.API_BASE;
    let currentStatus = 'draft';
    let dirty = false;
    let saving = false;
    let focusMode = false;
    let statusTimer;
    let autoSaveTimer;
    let changeVersion = 0;
    let generatedSlug = '';
    let suppressEditorChanges = false;
    let featuredPreviewFile = null;
    let featuredPreviewObjectUrl = '';
    let featuredPreviewSource = '';

    const byId = (id) => document.getElementById(id);
    const token = () => localStorage.getItem('adminToken');
    const setStatus = (message, state = '') => {
        const status = byId('blogSaveStatus');
        if (!status) return;
        status.textContent = message;
        status.dataset.state = state;
    };
    const markDirty = () => {
        if (suppressEditorChanges) return;
        changeVersion += 1;
        dirty = true;
        setStatus(currentStatus === 'published' ? 'Unsaved published edits' : 'Unsaved changes', 'dirty');
        if (currentStatus === 'published') byId('blogMessage').textContent = 'Published article edits are not auto-saved. Choose Save draft or Publish to save them.';
        updateWritingStats();
        updateSeoReview();
        clearTimeout(statusTimer);
        statusTimer = setTimeout(() => {
            if (dirty) setStatus(currentStatus === 'published' ? 'Published edits not saved' : 'Draft changes not saved', 'dirty');
        }, 1800);
        scheduleDraftAutoSave();
    };
    const value = (id) => byId(id)?.value.trim() || '';
    const setValue = (id, next) => { if (byId(id)) byId(id).value = next || ''; };
    const setChecked = (id, checked) => { if (byId(id)) byId(id).checked = Boolean(checked); };
    const slugify = (text) => String(text || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 160);
    const scheduleDraftAutoSave = () => {
        clearTimeout(autoSaveTimer);
        if (currentStatus !== 'draft') return;
        autoSaveTimer = setTimeout(() => {
            if (dirty && value('blogTitle')) saveBlog('draft', { automatic: true });
        }, 1800);
    };
    const setEditorContent = (html) => {
        const editor = window.tinymce?.get('blogContent');
        if (editor) editor.setContent(html || '');
        else if (byId('blogContent')) byId('blogContent').value = html || '';
    };
    const editorContent = () => {
        const editor = window.tinymce?.get('blogContent');
        return editor ? editor.getContent() : (byId('blogContent')?.value || '');
    };
    const updateFeaturedImagePreview = () => {
        const file = byId('blogImageFile')?.files?.[0];
        if (file) {
            if (file !== featuredPreviewFile) {
                if (featuredPreviewObjectUrl) URL.revokeObjectURL(featuredPreviewObjectUrl);
                featuredPreviewFile = file;
                featuredPreviewObjectUrl = URL.createObjectURL(file);
            }
            featuredPreviewSource = featuredPreviewObjectUrl;
        } else {
            if (featuredPreviewObjectUrl) URL.revokeObjectURL(featuredPreviewObjectUrl);
            featuredPreviewFile = null; featuredPreviewObjectUrl = '';
            const url = value('blogImageUrl');
            featuredPreviewSource = /^https?:\/\//i.test(url) ? url : '';
        }
        const preview = byId('blogFeaturedImagePreview');
        const image = byId('blogFeaturedImagePreviewImg');
        if (!preview || !image) return;
        preview.hidden = !featuredPreviewSource;
        if (featuredPreviewSource) {
            image.src = featuredPreviewSource;
            image.alt = value('blogImageAlt') || 'Featured image preview';
        } else image.removeAttribute('src');
    };

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
            const row = body.insertRow();
            const title = row.insertCell(); title.textContent = blog.title || 'Untitled';
            row.insertCell().textContent = blog.category || 'General';
            const badge = document.createElement('span'); badge.className = `blog-status-badge ${isPublished ? 'is-published' : 'is-draft'}`; badge.textContent = isPublished ? 'Published' : 'Draft'; row.insertCell().appendChild(badge);
            row.insertCell().textContent = blog.featured ? 'Yes' : 'No';
            row.insertCell().textContent = new Date(blog.updatedAt || blog.createdAt).toLocaleDateString('en-IN');
            const actions = row.insertCell(); actions.className = 'blog-list-actions';
            const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'btn btn-edit'; edit.textContent = 'Edit'; edit.addEventListener('click', () => openEditBlog(blog._id)); actions.appendChild(edit);
            if (isPublished) {
                const view = document.createElement('a'); view.className = 'btn btn-view'; view.textContent = 'View'; view.href = `../blog.html?slug=${encodeURIComponent(blog.slug)}`; view.target = '_blank'; view.rel = 'noopener'; actions.appendChild(view);
            }
            const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn btn-delete'; remove.textContent = 'Delete'; remove.addEventListener('click', () => deleteBlog(blog._id, blog.title || 'Untitled')); actions.appendChild(remove);
        });
        tableWrap.appendChild(table); container.appendChild(tableWrap);
    }

    function newBlog() {
        if (saving) { showAlert('Wait for the current save to finish before starting another article.', 'error'); return; }
        if (!confirmDiscard()) return;
        clearTimeout(autoSaveTimer);
        byId('blogEditorForm').reset();
        suppressEditorChanges = true; setEditorContent(''); suppressEditorChanges = false;
        updateFeaturedImagePreview();
        setValue('blogId', '');
        setValue('blogSlug', '');
        setValue('blogPublishedAt', '');
        generatedSlug = '';
        byId('blogEditorHeading').textContent = 'New article';
        byId('blogMessage').textContent = '';
        currentStatus = 'draft'; dirty = false; changeVersion += 1;
        setStatus('New draft', 'saved');
        showModal('blogEditorModal');
        setTimeout(() => window.tinymce?.get('blogContent')?.focus(), 100);
        updateWritingStats(); updateSeoReview();
    }

    async function openEditBlog(blogId) {
        if (saving) { showAlert('Wait for the current save to finish before opening another article.', 'error'); return; }
        if (!confirmDiscard()) return;
        clearTimeout(autoSaveTimer);
        byId('blogImageFile').value = '';
        try {
            const response = await fetch(`${apiBase()}/api/blogs/id/${encodeURIComponent(blogId)}`, { headers: { Authorization: `Bearer ${token()}` } });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || 'Could not load this article');
            const blog = data.blog;
            setValue('blogId', blog._id); setValue('blogTitle', blog.title); setValue('blogSubtitle', blog.subtitle);
            setValue('blogCategory', blog.category); setValue('blogTags', (blog.tags || []).join(', ')); setValue('blogAuthor', blog.authorName);
            setValue('blogPublishedAt', blog.publishedAt ? new Date(blog.publishedAt).toISOString().slice(0, 16) : '');
            setValue('blogExcerpt', blog.excerpt); setValue('blogImageUrl', blog.image); setValue('blogImageAlt', blog.imageAlt); setValue('blogImageCaption', blog.imageCaption);
            updateFeaturedImagePreview();
            setValue('blogSlug', blog.slug); setValue('blogMetaTitle', blog.metaTitle); setValue('blogMetaDescription', blog.metaDescription);
            setValue('blogFocusKeyword', blog.focusKeyword); setValue('blogCanonicalUrl', blog.canonicalUrl);
            setValue('blogSocialTitle', blog.socialTitle); setValue('blogSocialDescription', blog.socialDescription); setValue('blogSocialImage', blog.socialImage);
            setChecked('blogFeatured', blog.featured);
            suppressEditorChanges = true; setEditorContent(blog.content); suppressEditorChanges = false;
            currentStatus = blog.status || 'published'; dirty = false; changeVersion += 1; generatedSlug = '';
            byId('blogEditorHeading').textContent = currentStatus === 'published' ? 'Edit published article' : 'Edit draft';
            byId('blogMessage').textContent = ''; setStatus(`Saved · ${currentStatus}`, 'saved');
            showModal('blogEditorModal');
            setTimeout(() => { updateWritingStats(); updateSeoReview(); }, 150);
        } catch (error) { showAlert(error.message || 'Failed to load article', 'error'); }
    }

    function confirmDiscard() {
        if (!dirty) return true;
        return confirm('You have unsaved changes. Leave the editor and discard them?');
    }

    function closeBlogEditor() {
        if (saving) { showAlert('Wait for the current save to finish before closing the editor.', 'error'); return; }
        if (!confirmDiscard()) return;
        clearTimeout(autoSaveTimer); clearTimeout(statusTimer); dirty = false;
        hideModal('blogEditorModal');
        document.body.classList.remove('blog-writing-focus'); focusMode = false;
    }

    function collectPayload(status) {
        const chosenDate = value('blogPublishedAt');
        return {
            title: value('blogTitle'), subtitle: value('blogSubtitle'), content: editorContent(),
            category: value('blogCategory') || 'General', tags: value('blogTags').split(',').map((item) => item.trim()).filter(Boolean),
            authorName: value('blogAuthor'), publishedAt: chosenDate ? new Date(chosenDate).toISOString() : undefined,
            excerpt: value('blogExcerpt'), image: value('blogImageUrl'), imageAlt: value('blogImageAlt'), imageCaption: value('blogImageCaption'),
            slug: value('blogSlug'), metaTitle: value('blogMetaTitle'), metaDescription: value('blogMetaDescription'),
            focusKeyword: value('blogFocusKeyword'), canonicalUrl: value('blogCanonicalUrl'), socialTitle: value('blogSocialTitle'),
            socialDescription: value('blogSocialDescription'), socialImage: value('blogSocialImage'),
            featured: byId('blogFeatured')?.checked || false, status
        };
    }

    function uploadImage(file, onProgress = () => {}) {
        return new Promise((resolve, reject) => {
            if (!file) return resolve('');
            const allowed = ['image/jpeg', 'image/png', 'image/webp'];
            if (!allowed.includes(file.type)) return reject(new Error('Choose a JPG, PNG, or WebP image.'));
            if (file.size > 8 * 1024 * 1024) return reject(new Error('Images must be 8 MB or smaller.'));
            const form = new FormData(); form.append('image', file, file.name);
            const request = new XMLHttpRequest();
            request.open('POST', `${apiBase()}/api/blogs/upload-image`);
            request.setRequestHeader('Authorization', `Bearer ${token()}`);
            request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
            request.onload = () => {
                try {
                    const result = JSON.parse(request.responseText || '{}');
                    if (request.status >= 200 && request.status < 300 && result.success && result.url) resolve(result.url);
                    else reject(new Error(result.message || 'Image upload failed.'));
                } catch { reject(new Error('Image upload returned an invalid response.')); }
            };
            request.onerror = () => reject(new Error('Network error while uploading image.'));
            request.send(form);
        });
    }

    async function saveBlog(status, { automatic = false } = {}) {
        if (saving) return;
        if (automatic && currentStatus !== 'draft') return;
        if (status === 'draft' && currentStatus === 'published' && value('blogId') && !automatic && !confirm('Saving as a draft will hide this article from public pages. Continue?')) return;
        const payload = collectPayload(status);
        if (!payload.title) { if (!automatic) { byId('blogTitle').focus(); showAlert('Enter an article title.', 'error'); } return; }
        if (status === 'published' && !payload.content.replace(/<[^>]*>/g, '').trim()) { if (!automatic) showAlert('Add article content before publishing.', 'error'); return; }
        clearTimeout(autoSaveTimer);
        const savedVersion = changeVersion;
        saving = true; setStatus(automatic ? 'Auto-saving draft...' : 'Saving...', 'saving'); byId('blogMessage').textContent = '';
        try {
            const featuredFile = byId('blogImageFile').files[0];
            if (featuredFile) {
                setStatus('Uploading featured image...', 'saving');
                payload.image = await uploadImage(featuredFile, (percent) => setStatus('Uploading featured image - ' + percent + '%', 'saving'));
                setValue('blogImageUrl', payload.image);
                if (byId('blogImageFile').files[0] === featuredFile) byId('blogImageFile').value = '';
                updateFeaturedImagePreview();
            }
            const blogId = value('blogId');
            const response = await fetch(apiBase() + '/api/blogs' + (blogId ? '/' + encodeURIComponent(blogId) : ''), {
                method: blogId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || 'Unable to save article');
            setValue('blogId', data.blog._id);
            currentStatus = data.blog.status;
            if (changeVersion === savedVersion) {
                setValue('blogSlug', data.blog.slug);
                if (data.blog.publishedAt) setValue('blogPublishedAt', new Date(data.blog.publishedAt).toISOString().slice(0, 16));
                dirty = false;
            }
            byId('blogEditorHeading').textContent = currentStatus === 'published' ? 'Edit published article' : 'Edit draft';
            byId('blogMessage').textContent = automatic ? 'Draft auto-saved.' : (currentStatus === 'published' ? 'Published successfully.' : 'Draft saved.');
            if (dirty) setStatus('Changes made while saving', 'dirty');
            else setStatus(automatic ? 'Draft auto-saved' : (currentStatus === 'published' ? 'Published' : 'Draft saved'), 'saved');
            loadBlogs();
        } catch (error) {
            setStatus('Save failed', 'error'); byId('blogMessage').textContent = error.message || 'Unable to save article.';
        } finally {
            saving = false;
            if (dirty && changeVersion !== savedVersion && currentStatus === 'draft') scheduleDraftAutoSave();
        }
    }

    function previewBlog() {
        updateFeaturedImagePreview();
        const title = value('blogTitle') || 'Untitled article';
        const subtitle = value('blogSubtitle'); const excerpt = value('blogExcerpt');
        const img = featuredPreviewSource; const alt = value('blogImageAlt'); const caption = value('blogImageCaption');
        const escape = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
        const safeImage = /^(https?:\/\/|blob:)/i.test(img) ? `<figure><img src="${escape(img)}" alt="${escape(alt)}">${caption ? `<figcaption>${escape(caption)}</figcaption>` : ''}</figure>` : '';
        const frame = byId('blogPreviewFrame');
        frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{font:17px/1.8 Georgia,serif;color:#243044;max-width:760px;margin:40px auto;padding:0 24px}h1{font:700 42px/1.15 Arial,sans-serif;color:#14233d;margin:0}h2,h3,h4{font:600 25px/1.35 Arial,sans-serif;color:#182840}header{border-bottom:1px solid #e5eaf0;padding-bottom:25px;margin-bottom:28px}.sub{font:22px/1.5 Arial;color:#65738a}.excerpt{font:18px/1.6 Arial;color:#53647a}article{line-height:1.8}a{color:#2458a6}ul,ol{padding-left:2em}figure{margin:30px 0}img{max-width:100%;height:auto}figcaption{font:14px Arial;color:#68758a;text-align:center}table{border-collapse:collapse;width:100%;margin:20px 0}td,th{border:1px solid #d9e0e8;padding:8px}blockquote{border-left:4px solid #7890ba;padding-left:18px;color:#54647a}pre{overflow:auto;background:#eef2f7;padding:14px}iframe{display:block;width:100%;aspect-ratio:16/9;height:auto;border:0}</style></head><body><header><h1>${escape(title)}</h1>${subtitle ? `<p class="sub">${escape(subtitle)}</p>` : ''}${excerpt ? `<p class="excerpt">${escape(excerpt)}</p>` : ''}</header>${safeImage}<article class="blog-content">${editorContent()}</article></body></html>`;
        showModal('blogPreviewModal');
    }

    function toggleWritingMode() {
        focusMode = !focusMode; document.body.classList.toggle('blog-writing-focus', focusMode);
    }

    function updateWritingStats() {
        const editor = window.tinymce?.get('blogContent');
        const text = editor ? editor.getContent({ format: 'text' }) : (byId('blogContent')?.value || '');
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        byId('blogWordCount').textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
        byId('blogCharCount').textContent = `${text.length} characters`;
        byId('blogReadTime').textContent = `${Math.max(1, Math.ceil(words / 200))} min read`;
        const sentences = text.trim().split(/[.!?।]+/).filter((sentence) => sentence.trim()).length;
        const averageSentence = sentences ? words / sentences : 0;
        byId('blogReadability').textContent = words ? `Readability: ${averageSentence <= 14 ? 'Easy' : averageSentence <= 22 ? 'Moderate' : 'Long sentences'}` : 'Readability: N/A';
    }

    function updateSeoReview() {
        const title = value('blogMetaTitle') || value('blogTitle');
        const description = value('blogMetaDescription') || value('blogExcerpt');
        const editor = window.tinymce?.get('blogContent');
        const body = editor ? editor.getContent() : (byId('blogContent')?.value || '');
        const text = editor ? editor.getContent({ format: 'text' }) : (byId('blogContent')?.value || '');
        const keyword = value('blogFocusKeyword').toLowerCase();
        const parsedContent = new DOMParser().parseFromString(body, 'text/html');
        const allImagesHaveAlt = [...parsedContent.querySelectorAll('img')].every((image) => image.alt.trim().length > 0);
        const headings = [...parsedContent.querySelectorAll('h1,h2,h3,h4')];
        let previousHeadingLevel = 0;
        const headingStructureValid = headings.length > 0 && headings.every((heading, index) => {
            const level = Number(heading.tagName.slice(1));
            const valid = index === 0 || level <= previousHeadingLevel + 1;
            previousHeadingLevel = level;
            return valid;
        });
        const links = [...parsedContent.querySelectorAll('a[href]')].map((anchor) => {
            try { return new URL(anchor.getAttribute('href'), window.location.origin); } catch { return null; }
        }).filter(Boolean);
        const hasInternalLink = links.some((link) => link.host === window.location.host);
        const hasExternalLink = links.some((link) => ['http:', 'https:'].includes(link.protocol) && link.host !== window.location.host);
        const metaTitleCount = byId('blogMetaTitleCount');
        const metaDescriptionCount = byId('blogMetaDescriptionCount');
        if (metaTitleCount) metaTitleCount.textContent = `${title.length} / 160`;
        if (metaDescriptionCount) metaDescriptionCount.textContent = `${description.length} / 320`;
        const checks = [
            [title.length >= 30 && title.length <= 60, `SEO title · ${title.length} characters (aim for 30–60)`],
            [description.length >= 70 && description.length <= 160, `Meta description · ${description.length} characters (aim for 70–160)`],
            [headingStructureValid, 'Add headings in a clear, ordered structure'],
            [hasInternalLink, 'Add an internal link'],
            [hasExternalLink, 'Add an external link'],
            [allImagesHaveAlt && (!value('blogImageUrl') || value('blogImageAlt')), 'Add alt text to article images'],
            [!keyword || text.toLowerCase().includes(keyword), 'Use the focus keyword in the article']
        ];
        const list = byId('blogSeoChecks'); list.replaceChildren();
        checks.forEach(([ok, label]) => { const li = document.createElement('li'); li.textContent = `${ok ? '✓' : '○'} ${label}`; li.className = ok ? 'seo-ok' : 'seo-note'; list.appendChild(li); });
        const titleText = value('blogMetaTitle') || title || 'Search preview title';
        const descriptionText = value('blogMetaDescription') || value('blogExcerpt') || 'Your meta description preview appears here.';
        const preview = byId('blogSearchPreview'); preview.replaceChildren();
        const resultTitle = document.createElement('strong'); resultTitle.textContent = titleText;
        const url = document.createElement('small'); url.textContent = `${window.location.host}/blog.html?slug=${value('blogSlug') || 'article-slug'}`;
        const resultDescription = document.createElement('p'); resultDescription.textContent = descriptionText;
        preview.append(url, resultTitle, resultDescription);
    }

    async function deleteBlog(blogId, title) {
        if (!confirm(`Delete “${title}”? This cannot be undone.`)) return;
            try {
                const response = await fetch(`${apiBase()}/api/blogs/${encodeURIComponent(blogId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
                const data = await response.json();
                if (!response.ok || !data.success) throw new Error(data.message || 'Delete failed');
                showAlert('Article deleted.', 'success'); loadBlogs();
            } catch (error) { showAlert(error.message || 'Delete failed.', 'error'); }
    }

    function initMainTinyMCE() {
        if (!byId('blogContent') || window.tinymce?.get('blogContent')) return;
        if (!window.tinymce) {
            setStatus('Rich editor unavailable', 'error');
            byId('blogMessage').textContent = 'The writing editor could not load. Check the connection and reload this page.';
            return;
        }
        window.tinymce.init({
            selector: '#blogContent', height: 760, min_height: 480, menubar: 'edit insert format table', branding: false,
            resize: true, promotion: false, statusbar: true, elementpath: true, browser_spellcheck: true,
            plugins: 'advlist autolink lists link image table charmap preview searchreplace visualblocks code fullscreen wordcount quickbars autoresize media',
            toolbar: 'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough superscript subscript | forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent lineheight | styles | blockquote codeformat | link unlink image table hr media | removeformat | preview fullscreen',
            toolbar_mode: 'sliding', quickbars_selection_toolbar: 'bold italic underline | link blockquote',
            block_formats: 'Paragraph=p; Heading 1=h1; Heading 2=h2; Heading 3=h3; Heading 4=h4; Preformatted=pre',
            style_formats_merge: true,
            style_formats: [{ title: 'Paragraph spacing', items: [
                { title: 'Compact', block: 'p', styles: { 'margin-bottom': '0.5em' } },
                { title: 'Standard', block: 'p', styles: { 'margin-bottom': '1em' } },
                { title: 'Relaxed', block: 'p', styles: { 'margin-bottom': '1.5em' } }
            ] }],
            line_height_formats: '1 1.15 1.3 1.5 1.75 2',
            image_caption: true, image_advtab: true, automatic_uploads: true, object_resizing: true,
            table_toolbar: 'tableprops tabledelete | tableinsertrowbefore tableinsertrowafter tabledeleterow | tableinsertcolbefore tableinsertcolafter tabledeletecol',
            table_default_attributes: { border: '1' }, table_default_styles: { width: '100%', borderCollapse: 'collapse' },
            content_style: 'body{box-sizing:border-box;width:100%;max-width:794px;min-height:1056px;margin:0 auto;padding:64px 56px;font-family:Georgia,serif;font-size:18px;line-height:1.8;color:#27364b}h1,h2,h3,h4{font-family:Arial,sans-serif;line-height:1.3;color:#182840}img{max-width:100%;height:auto}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccd5e0;padding:8px}blockquote{border-left:4px solid #7b91b6;padding-left:18px;color:#53647a}iframe{max-width:100%}@media(max-width:760px){body{min-height:480px;padding:32px 20px}}',
            images_upload_handler: (blobInfo, progress) => new Promise((resolve, reject) => {
                uploadImage(blobInfo.blob(), progress).then(resolve).catch((error) => reject({ message: error.message, remove: true }));
            }),
            media_url_resolver: (data) => new Promise((resolve) => {
                try {
                    const url = new URL(data.url);
                    const host = url.hostname.toLowerCase();
                    const allowedHosts = ['youtube.com', 'www.youtube.com', 'youtu.be', 'youtube-nocookie.com', 'www.youtube-nocookie.com'];
                    let videoId = '';
                    if (host === 'youtu.be') videoId = url.pathname.split('/').filter(Boolean)[0] || '';
                    else if (allowedHosts.includes(host)) videoId = url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)/)?.[1] || '';
                    if (!/^[\w-]{6,20}$/.test(videoId)) return resolve({ html: '' });
                    resolve({ html: `<iframe title="YouTube video" width="560" height="315" src="https://www.youtube-nocookie.com/embed/${videoId}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>` });
                } catch { resolve({ html: '' }); }
            }),
            setup: (editor) => {
                editor.on('input change undo redo keyup', () => { updateWritingStats(); updateSeoReview(); markDirty(); });
                editor.on('init', () => { updateWritingStats(); updateSeoReview(); });
            }
        }).catch((error) => {
            console.error('Blog editor initialization failed:', error);
            setStatus('Editor failed to initialize', 'error');
            byId('blogMessage').textContent = 'The writing editor failed to initialize. Reload this page before writing.';
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        ['blogTitle', 'blogSubtitle', 'blogCategory', 'blogTags', 'blogAuthor', 'blogPublishedAt', 'blogExcerpt', 'blogImageUrl', 'blogImageAlt', 'blogImageCaption', 'blogSlug', 'blogMetaTitle', 'blogMetaDescription', 'blogFocusKeyword', 'blogCanonicalUrl', 'blogSocialTitle', 'blogSocialDescription', 'blogSocialImage'].forEach((id) => byId(id)?.addEventListener('input', markDirty));
        byId('blogFeatured')?.addEventListener('change', markDirty);
        byId('blogImageFile')?.addEventListener('change', () => { markDirty(); updateFeaturedImagePreview(); });
        byId('blogImageUrl')?.addEventListener('input', updateFeaturedImagePreview);
        byId('blogImageAlt')?.addEventListener('input', updateFeaturedImagePreview);
        byId('blogContent')?.addEventListener('input', () => { updateWritingStats(); updateSeoReview(); markDirty(); });
        byId('blogTitle')?.addEventListener('input', () => {
            const currentSlug = value('blogSlug');
            if (!currentSlug || currentSlug === generatedSlug) {
                generatedSlug = slugify(value('blogTitle'));
                setValue('blogSlug', generatedSlug);
            }
            updateSeoReview();
        });
        window.addEventListener('beforeunload', (event) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
        initMainTinyMCE();
    });

    window.loadBlogs = loadBlogs;
    window.forceLoadBlogs = loadBlogs;
    window.newBlog = newBlog;
    window.openEditBlog = openEditBlog;
    window.deleteBlog = deleteBlog;
    window.initMainTinyMCE = initMainTinyMCE;
    window.saveBlog = saveBlog;
    window.previewBlog = previewBlog;
    window.closeBlogEditor = closeBlogEditor;
    window.toggleWritingMode = toggleWritingMode;
})();
