// Full-page blog editor (admin/blog-editor.html). ?id=<blogId> edits, no id starts a new article.
(() => {
    const apiBase = () => window.API_BASE;
    let currentStatus = 'draft';
    let dirty = false;
    let saving = false;
    let statusTimer;
    let autoSaveTimer;
    let backupTimer;
    let changeVersion = 0;
    let generatedSlug = '';
    let suppressEditorChanges = false;
    let featuredPreviewFile = null;
    let featuredPreviewObjectUrl = '';
    let featuredPreviewSource = '';
    let mediaCursor = null;

    const FIELD_IDS = ['blogTitle', 'blogSubtitle', 'blogCategory', 'blogTags', 'blogAuthor', 'blogPublishedAt', 'blogExcerpt', 'blogImageUrl', 'blogImageAlt', 'blogImageCaption', 'blogSlug', 'blogMetaTitle', 'blogMetaDescription', 'blogFocusKeyword', 'blogCanonicalUrl', 'blogSocialTitle', 'blogSocialDescription', 'blogSocialImage'];
    // Same block styles as css/blog.css, so the editor looks like the public page.
    const BLOCK_CSS = '.blog-callout{margin:1.4em 0;padding:14px 18px;border-left:4px solid #3b6fc4;border-radius:6px;background:#eef4ff}.blog-callout p{margin:.3em 0}.blog-callout-tip{border-left-color:#1f9d63;background:#eaf8f1}.blog-callout-warning{border-left-color:#d08a12;background:#fff6e5}.blog-faq{margin:1.5em 0;border:1px solid #dfe5ee;border-radius:8px}.blog-faq-item{padding:12px 16px;border-top:1px solid #e7ecf2}.blog-faq-item:first-child{border-top:0}.blog-faq-item p{margin:.3em 0}.blog-btn{display:inline-block;padding:10px 22px;border-radius:6px;background:#2458a6;color:#fff!important;font-family:Arial,sans-serif;font-weight:600;text-decoration:none}.blog-toc{margin:1.5em 0;padding:14px 20px;border:1px solid #dfe5ee;border-radius:8px;background:#f7f9fc}.blog-toc p{margin:0}.blog-toc ul{margin:.5em 0 0;padding-left:1.2em}.blog-toc .blog-toc-sub{margin-left:1.2em}';

    const byId = (id) => document.getElementById(id);
    const token = () => localStorage.getItem('adminToken');
    const authHeaders = () => ({ headers: { Authorization: `Bearer ${token()}` } });
    const goLogin = () => { window.location.href = '../admin_login.html'; };
    const getEditor = () => window.tinymce?.get('blogContent');
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
        if (currentStatus === 'published') byId('blogMessage').textContent = 'Published article edits are not auto-saved. Press Update (or Ctrl+S) to save them.';
        updateWritingStats();
        updateSeoReview();
        updateScheduleNote();
        clearTimeout(statusTimer);
        statusTimer = setTimeout(() => {
            if (dirty) setStatus(currentStatus === 'published' ? 'Published edits not saved' : 'Draft changes not saved', 'dirty');
        }, 1800);
        clearTimeout(backupTimer);
        backupTimer = setTimeout(writeBackup, 800);
        scheduleDraftAutoSave();
    };
    const value = (id) => byId(id)?.value.trim() || '';
    const setValue = (id, next) => { if (byId(id)) byId(id).value = next || ''; };
    const setChecked = (id, checked) => { if (byId(id)) byId(id).checked = Boolean(checked); };
    const slugify = (text) => String(text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 160);
    const escape = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    // datetime-local wants local time, not UTC.
    const toLocalInput = (date) => {
        const local = new Date(date);
        local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
        return local.toISOString().slice(0, 16);
    };
    const scheduleDraftAutoSave = () => {
        clearTimeout(autoSaveTimer);
        if (currentStatus !== 'draft') return;
        autoSaveTimer = setTimeout(() => {
            if (dirty && value('blogTitle')) saveBlog('draft', { automatic: true });
        }, 1800);
    };
    const setEditorContent = (html) => {
        const editor = getEditor();
        if (editor) editor.setContent(html || '');
        else if (byId('blogContent')) byId('blogContent').value = html || '';
    };
    const editorContent = () => {
        const editor = getEditor();
        return editor ? editor.getContent() : (byId('blogContent')?.value || '');
    };

    /* ---------- Local backup (survives a closed tab or lost connection) ---------- */
    const backupKey = (id = value('blogId')) => `blogEditorBackup:${id || 'new'}`;
    function writeBackup() {
        if (!dirty) return;
        try {
            localStorage.setItem(backupKey(), JSON.stringify({
                savedAt: Date.now(),
                fields: Object.fromEntries(FIELD_IDS.map((id) => [id, byId(id)?.value || ''])),
                featured: byId('blogFeatured')?.checked || false,
                content: editorContent()
            }));
        } catch { /* storage full or blocked: server save still works */ }
    }
    const clearBackup = () => { localStorage.removeItem(backupKey()); localStorage.removeItem(backupKey('new')); };
    function offerBackupRestore(serverUpdatedAt) {
        let backup;
        try { backup = JSON.parse(localStorage.getItem(backupKey()) || 'null'); } catch { backup = null; }
        if (!backup) return;
        if (serverUpdatedAt && backup.savedAt <= Date.parse(serverUpdatedAt)) { localStorage.removeItem(backupKey()); return; }
        if (!confirm(`Restore unsaved changes from ${new Date(backup.savedAt).toLocaleString('en-IN')}?`)) { localStorage.removeItem(backupKey()); return; }
        FIELD_IDS.forEach((id) => setValue(id, backup.fields?.[id]));
        setChecked('blogFeatured', backup.featured);
        suppressEditorChanges = true; setEditorContent(backup.content); suppressEditorChanges = false;
        updateFeaturedImagePreview();
        markDirty();
        byId('blogMessage').textContent = 'Unsaved changes restored. Save to keep them.';
    }

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

    function updateScheduleNote() {
        const chosen = value('blogPublishedAt');
        const future = chosen && new Date(chosen) > new Date();
        const note = byId('blogScheduleNote');
        if (note) note.textContent = future ? `Scheduled for ${new Date(chosen).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}${currentStatus === 'published' ? '' : ' (after you press Schedule)'}` : '';
        byId('blogPublishLabel').textContent = currentStatus === 'published' ? 'Update' : (future ? 'Schedule' : 'Publish');
    }
    function updateHeading() {
        byId('blogEditorHeading').textContent = !value('blogId') ? 'New article' : (currentStatus === 'published' ? 'Edit published article' : 'Edit draft');
        updateScheduleNote();
    }

    function startNewArticle() {
        currentStatus = 'draft'; dirty = false;
        setStatus('New draft', 'saved');
        updateHeading(); updateWritingStats(); updateSeoReview();
        offerBackupRestore(null);
        setTimeout(() => getEditor()?.focus(), 100);
    }

    async function loadArticle(blogId) {
        setStatus('Loading…', 'saving');
        try {
            const response = await fetch(`${apiBase()}/api/blogs/id/${encodeURIComponent(blogId)}`, authHeaders());
            if (response.status === 401) return goLogin();
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || 'Could not load this article');
            const blog = data.blog;
            byId('blogImageFile').value = '';
            setValue('blogId', blog._id); setValue('blogTitle', blog.title); setValue('blogSubtitle', blog.subtitle);
            setValue('blogCategory', blog.category); setValue('blogTags', (blog.tags || []).join(', ')); setValue('blogAuthor', blog.authorName);
            setValue('blogPublishedAt', blog.publishedAt ? toLocalInput(blog.publishedAt) : '');
            setValue('blogExcerpt', blog.excerpt); setValue('blogImageUrl', blog.image); setValue('blogImageAlt', blog.imageAlt); setValue('blogImageCaption', blog.imageCaption);
            updateFeaturedImagePreview();
            setValue('blogSlug', blog.slug); setValue('blogMetaTitle', blog.metaTitle); setValue('blogMetaDescription', blog.metaDescription);
            setValue('blogFocusKeyword', blog.focusKeyword); setValue('blogCanonicalUrl', blog.canonicalUrl);
            setValue('blogSocialTitle', blog.socialTitle); setValue('blogSocialDescription', blog.socialDescription); setValue('blogSocialImage', blog.socialImage);
            setChecked('blogFeatured', blog.featured);
            suppressEditorChanges = true; setEditorContent(blog.content); suppressEditorChanges = false;
            currentStatus = blog.status || 'published'; dirty = false; changeVersion += 1; generatedSlug = '';
            byId('blogMessage').textContent = ''; setStatus(`Saved · ${currentStatus}`, 'saved');
            updateHeading(); updateWritingStats(); updateSeoReview();
            document.title = `${blog.title || 'Untitled'} · Blog editor`;
            offerBackupRestore(blog.updatedAt);
        } catch (error) {
            setStatus('Load failed', 'error');
            byId('blogMessage').textContent = error.message || 'Failed to load article.';
        }
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
            const form = new FormData(); form.append('image', file, file.name || 'pasted-image.png');
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
        if (!value('blogTitle')) { if (!automatic) { byId('blogTitle').focus(); showAlert('Enter an article title.', 'error'); } return; }
        clearTimeout(autoSaveTimer);
        const savedVersion = changeVersion;
        saving = true; setStatus(automatic ? 'Auto-saving draft...' : 'Saving...', 'saving'); byId('blogMessage').textContent = '';
        try {
            // Pasted/dropped images must finish uploading, or their blob: URLs would be saved.
            await getEditor()?.uploadImages();
            const payload = collectPayload(status);
            payload.revision = !automatic;
            if (status === 'published' && !payload.content.replace(/<[^>]*>/g, '').trim()) { if (!automatic) showAlert('Add article content before publishing.', 'error'); setStatus('Not saved', 'error'); return; }
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
            if (response.status === 401) { writeBackup(); showAlert('Your admin session expired. Your text is kept in this browser; sign in again.', 'error'); setStatus('Sign in again', 'error'); return; }
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || 'Unable to save article');
            setValue('blogId', data.blog._id);
            if (!new URLSearchParams(window.location.search).get('id')) history.replaceState(null, '', `?id=${encodeURIComponent(data.blog._id)}`);
            currentStatus = data.blog.status;
            if (changeVersion === savedVersion) {
                setValue('blogSlug', data.blog.slug);
                if (data.blog.publishedAt) setValue('blogPublishedAt', toLocalInput(data.blog.publishedAt));
                dirty = false;
                clearTimeout(backupTimer); clearBackup();
            }
            updateHeading();
            const scheduled = currentStatus === 'published' && data.blog.publishedAt && new Date(data.blog.publishedAt) > new Date();
            byId('blogMessage').textContent = automatic ? 'Draft auto-saved.' : (scheduled ? `Scheduled. It goes live on ${new Date(data.blog.publishedAt).toLocaleString('en-IN')}.` : (currentStatus === 'published' ? 'Published successfully.' : 'Draft saved.'));
            if (dirty) setStatus('Changes made while saving', 'dirty');
            else setStatus(automatic ? 'Draft auto-saved' : (scheduled ? 'Scheduled' : (currentStatus === 'published' ? 'Published' : 'Draft saved')), 'saved');
        } catch (error) {
            setStatus('Save failed', 'error'); byId('blogMessage').textContent = (error.message || 'Unable to save article.') + ' Your text is kept in this browser.';
            writeBackup();
        } finally {
            saving = false;
            if (dirty && changeVersion !== savedVersion && currentStatus === 'draft') scheduleDraftAutoSave();
        }
    }
    const quickSave = () => saveBlog(currentStatus === 'published' ? 'published' : 'draft');

    function previewDocument({ title, subtitle = '', excerpt = '', image = '', alt = '', caption = '', content }) {
        const safeImage = /^(https?:\/\/|blob:)/i.test(image) ? `<figure><img src="${escape(image)}" alt="${escape(alt)}">${caption ? `<figcaption>${escape(caption)}</figcaption>` : ''}</figure>` : '';
        const blogCss = new URL('../css/blog.css', window.location.href).href;
        return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="${escape(blogCss)}"><style>body{font:17px/1.8 Georgia,serif;color:#243044;max-width:760px;margin:40px auto;padding:0 24px;background:#fff}h1{font:700 42px/1.15 Arial,sans-serif;color:#14233d;margin:0}h2,h3,h4{font:600 25px/1.35 Arial,sans-serif;color:#182840}header{border-bottom:1px solid #e5eaf0;padding-bottom:25px;margin-bottom:28px}.sub{font:22px/1.5 Arial;color:#65738a}.excerpt{font:18px/1.6 Arial;color:#53647a}article{line-height:1.8}a{color:#2458a6}ul,ol{padding-left:2em}figure{margin:30px 0}img{max-width:100%;height:auto}figcaption{font:14px Arial;color:#68758a;text-align:center}table{border-collapse:collapse;width:100%;margin:20px 0}td,th{border:1px solid #d9e0e8;padding:8px}blockquote{border-left:4px solid #7890ba;padding-left:18px;color:#54647a}pre{overflow:auto;background:#eef2f7;padding:14px}iframe{display:block;width:100%;aspect-ratio:16/9;height:auto;border:0}@media(max-width:500px){body{margin:20px auto;padding:0 16px}h1{font-size:30px}}</style></head><body><header><h1>${escape(title)}</h1>${subtitle ? `<p class="sub">${escape(subtitle)}</p>` : ''}${excerpt ? `<p class="excerpt">${escape(excerpt)}</p>` : ''}</header>${safeImage}<article class="blog-content">${content}</article></body></html>`;
    }

    function previewBlog() {
        updateFeaturedImagePreview();
        byId('blogPreviewFrame').srcdoc = previewDocument({
            title: value('blogTitle') || 'Untitled article', subtitle: value('blogSubtitle'), excerpt: value('blogExcerpt'),
            image: featuredPreviewSource, alt: value('blogImageAlt'), caption: value('blogImageCaption'), content: editorContent()
        });
        showModal('blogPreviewModal');
    }
    function setPreviewDevice(device) {
        byId('blogPreviewFrame').classList.toggle('is-mobile', device === 'mobile');
        document.querySelectorAll('.blog-device-toggle [data-device]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.device === device)));
    }

    const toggleWritingMode = () => document.body.classList.toggle('blog-writing-focus');
    const toggleSettings = () => document.body.classList.toggle('blog-settings-hidden');

    function updateWritingStats() {
        const editor = getEditor();
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
        const editor = getEditor();
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
        // Table-of-contents links (#toc-...) are not internal links to another page.
        const hasInternalLink = links.some((link) => link.host === window.location.host && !link.hash.startsWith('#toc-'));
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

    /* ---------- Paste from Word / Google Docs: keep bold/italic/links/lists, drop the rest ---------- */
    const unwrap = (el) => el.replaceWith(...el.childNodes);
    const wrapChildren = (el, tag) => { const wrapper = document.createElement(tag); wrapper.append(...el.childNodes); el.append(wrapper); };
    function cleanPastedNode(root) {
        root.querySelectorAll('b[id^="docs-internal-guid"]').forEach(unwrap);
        root.querySelectorAll('meta, style, link, xml, o\\:p').forEach((el) => el.remove());
        root.querySelectorAll('span[style]').forEach((span) => {
            // Read the raw attribute: parsed documents may not expose span.style.
            const style = span.getAttribute('style');
            if (/font-weight:\s*(bold|bolder|[6-9]00)\b/i.test(style)) wrapChildren(span, 'strong');
            if (/font-style:\s*italic/i.test(style)) wrapChildren(span, 'em');
        });
        root.querySelectorAll('*').forEach((el) => ['style', 'class', 'id', 'lang', 'dir', 'align', 'face', 'color', 'size'].forEach((name) => el.removeAttribute(name)));
        root.querySelectorAll('span, font').forEach(unwrap);
    }

    /* ---------- Custom blocks (classes allowed by sanitizeArticle on the server) ---------- */
    function insertCallout(kind, label) {
        const editor = getEditor();
        const selected = editor.selection.getContent({ format: 'text' }).trim();
        editor.insertContent(`<div class="blog-callout blog-callout-${kind}"><p><strong>${label}:</strong> ${editor.dom.encode(selected || 'Write here.')}</p></div><p></p>`);
    }
    function insertFaq() {
        const item = (n) => `<div class="blog-faq-item"><p class="blog-faq-q"><strong>Question ${n}?</strong></p><p>Answer ${n}.</p></div>`;
        getEditor().insertContent(`<div class="blog-faq">${item(1)}${item(2)}</div><p></p>`);
    }
    function insertButtonLink() {
        const editor = getEditor();
        editor.windowManager.open({
            title: 'Button link',
            body: { type: 'panel', items: [{ type: 'input', name: 'text', label: 'Button text' }, { type: 'input', name: 'url', label: 'Link (https://… or /page.html)' }] },
            initialData: { text: 'Read more', url: '' },
            buttons: [{ type: 'cancel', text: 'Cancel' }, { type: 'submit', text: 'Insert', buttonType: 'primary' }],
            onSubmit: (api) => {
                const { text, url } = api.getData();
                const href = url.trim();
                if (!/^(https?:\/\/\S+|\/\S*)$/i.test(href)) { editor.notificationManager.open({ text: 'Enter a link starting with https:// or /', type: 'error', timeout: 3000 }); return; }
                editor.insertContent(`<p>${editor.dom.createHTML('a', { class: 'blog-btn', href }, editor.dom.encode(text.trim() || 'Read more'))}</p>`);
                api.close();
            }
        });
    }
    function insertToc() {
        const editor = getEditor();
        const headings = editor.dom.select('h2,h3').filter((heading) => !editor.dom.getParent(heading, '.blog-toc'));
        if (!headings.length) { editor.notificationManager.open({ text: 'Add H2 or H3 headings first.', type: 'info', timeout: 3000 }); return; }
        const used = new Set();
        const items = headings.map((heading, index) => {
            let id = `toc-${slugify(heading.textContent).slice(0, 60) || index + 1}`;
            while (used.has(id)) id += `-${index + 1}`;
            used.add(id);
            editor.dom.setAttrib(heading, 'id', id);
            return `<li${heading.nodeName === 'H3' ? ' class="blog-toc-sub"' : ''}><a href="#${id}">${editor.dom.encode(heading.textContent)}</a></li>`;
        });
        const html = `<div class="blog-toc"><p><strong>Table of contents</strong></p><ul>${items.join('')}</ul></div>`;
        editor.undoManager.transact(() => {
            const existing = editor.dom.select('.blog-toc')[0];
            if (existing) editor.dom.setOuterHTML(existing, html);
            else editor.insertContent(html);
        });
        markDirty();
    }

    /* ---------- Media library (Cloudinary 'blogs' folder) ---------- */
    function openMedia() {
        mediaCursor = null;
        byId('blogMediaGrid').replaceChildren();
        showModal('blogMediaModal');
        loadMedia();
    }
    function pickMedia(url, target) {
        if (target === 'featured') {
            setValue('blogImageUrl', url); byId('blogImageFile').value = '';
            updateFeaturedImagePreview(); markDirty();
            showAlert('Featured image set. Add alt text in the Featured image panel.', 'success');
        } else {
            const editor = getEditor();
            if (!editor) return;
            editor.insertContent(editor.dom.createHTML('img', { src: url, alt: '' }));
            showAlert('Image inserted. Click it and add alt text (image button).', 'success');
        }
        hideModal('blogMediaModal');
    }
    async function loadMedia() {
        const grid = byId('blogMediaGrid');
        const more = byId('blogMediaMore');
        more.hidden = true;
        const loading = document.createElement('p'); loading.className = 'blog-media-loading'; loading.textContent = 'Loading images…';
        grid.after(loading);
        try {
            const response = await fetch(`${apiBase()}/api/blogs/admin/media${mediaCursor ? `?cursor=${encodeURIComponent(mediaCursor)}` : ''}`, authHeaders());
            if (response.status === 401) return goLogin();
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || 'Could not load images');
            data.images.forEach((image) => {
                const tile = document.createElement('div'); tile.className = 'blog-media-item';
                const thumb = document.createElement('img');
                thumb.src = image.url.replace('/upload/', '/upload/c_fill,w_240,h_180,q_auto,f_auto/');
                thumb.alt = image.publicId.split('/').pop(); thumb.loading = 'lazy';
                const insert = document.createElement('button'); insert.type = 'button'; insert.className = 'btn btn-primary'; insert.textContent = 'Insert';
                insert.addEventListener('click', () => pickMedia(image.url, 'insert'));
                const featured = document.createElement('button'); featured.type = 'button'; featured.className = 'btn btn-outline'; featured.textContent = 'Featured';
                featured.addEventListener('click', () => pickMedia(image.url, 'featured'));
                tile.append(thumb, insert, featured);
                grid.appendChild(tile);
            });
            if (!grid.children.length) grid.textContent = 'No images uploaded yet.';
            mediaCursor = data.nextCursor;
            more.hidden = !mediaCursor;
        } catch (error) {
            showAlert(error.message || 'Could not load images.', 'error');
        } finally { loading.remove(); }
    }

    /* ---------- Version history ---------- */
    async function openHistory() {
        const blogId = value('blogId');
        if (!blogId) { showAlert('Save the article once to start its history.', 'info'); return; }
        const list = byId('blogHistoryList');
        list.textContent = 'Loading…';
        byId('blogHistoryFrame').srcdoc = '<p style="font:14px Arial;color:#667">Choose a version to see it here.</p>';
        showModal('blogHistoryModal');
        try {
            const response = await fetch(`${apiBase()}/api/blogs/admin/revisions/${encodeURIComponent(blogId)}`, authHeaders());
            if (response.status === 401) return goLogin();
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || 'Could not load history');
            list.replaceChildren();
            if (!data.revisions.length) { list.textContent = 'No earlier versions yet. A version is kept each time you save manually (last 20).'; return; }
            data.revisions.forEach((revision) => {
                const item = document.createElement('li');
                const when = document.createElement('strong'); when.textContent = new Date(revision.savedAt).toLocaleString('en-IN');
                const title = document.createElement('span'); title.textContent = revision.title || 'Untitled';
                const view = document.createElement('button'); view.type = 'button'; view.className = 'btn btn-outline'; view.textContent = 'View';
                view.addEventListener('click', () => { byId('blogHistoryFrame').srcdoc = previewDocument({ title: revision.title || 'Untitled', content: revision.content }); });
                const restore = document.createElement('button'); restore.type = 'button'; restore.className = 'btn btn-primary'; restore.textContent = 'Restore';
                restore.addEventListener('click', () => restoreRevision(revision));
                item.append(when, title, view, restore);
                list.appendChild(item);
            });
        } catch (error) { list.textContent = error.message || 'Could not load history.'; }
    }
    async function restoreRevision(revision) {
        const when = new Date(revision.savedAt).toLocaleString('en-IN');
        if (!confirm(`Restore the version from ${when}? The current saved version stays in history.${dirty ? ' Your unsaved changes will be lost.' : ''}`)) return;
        try {
            const response = await fetch(`${apiBase()}/api/blogs/admin/revisions/${encodeURIComponent(revision._id)}/restore`, { method: 'POST', ...authHeaders() });
            if (response.status === 401) return goLogin();
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || 'Restore failed');
            dirty = false; clearBackup();
            hideModal('blogHistoryModal');
            await loadArticle(revision.blogId);
            byId('blogMessage').textContent = `Version from ${when} restored.`;
        } catch (error) { showAlert(error.message || 'Restore failed.', 'error'); }
    }

    function initMainTinyMCE(onReady) {
        if (!window.tinymce) {
            setStatus('Rich editor unavailable', 'error');
            byId('blogMessage').textContent = 'The writing editor could not load. Check the connection and reload this page.';
            onReady();
            return;
        }
        window.tinymce.init({
            selector: '#blogContent', height: 760, min_height: 480, menubar: 'edit insert format table', branding: false,
            resize: true, promotion: false, statusbar: true, elementpath: true, browser_spellcheck: true,
            plugins: 'advlist autolink lists link image table charmap preview searchreplace visualblocks code fullscreen wordcount quickbars autoresize media',
            toolbar: 'undo redo | blocks | bold italic underline | kpblocks kpmedia | link image table | bullist numlist | alignleft aligncenter alignright | forecolor backcolor strikethrough | outdent indent unlink hr media blockquote | fontfamily fontsize lineheight styles superscript subscript alignjustify codeformat | removeformat | code fullscreen',
            toolbar_mode: 'sliding', quickbars_selection_toolbar: 'bold italic underline | link blockquote',
            quickbars_insert_toolbar: false,
            block_formats: 'Paragraph=p; Heading 1=h1; Heading 2=h2; Heading 3=h3; Heading 4=h4; Preformatted=pre',
            style_formats_merge: true,
            style_formats: [{ title: 'Paragraph spacing', items: [
                { title: 'Compact', block: 'p', styles: { 'margin-bottom': '0.5em' } },
                { title: 'Standard', block: 'p', styles: { 'margin-bottom': '1em' } },
                { title: 'Relaxed', block: 'p', styles: { 'margin-bottom': '1.5em' } }
            ] }],
            line_height_formats: '1 1.15 1.3 1.5 1.75 2',
            image_caption: true, image_advtab: true, automatic_uploads: true, object_resizing: true,
            paste_data_images: true, paste_webkit_styles: 'font-weight font-style', paste_merge_formats: true,
            paste_preprocess: (editor, args) => {
                if (args.internal) return;
                const doc = new DOMParser().parseFromString(args.content, 'text/html');
                cleanPastedNode(doc.body);
                args.content = doc.body.innerHTML;
            },
            table_toolbar: 'tableprops tabledelete | tableinsertrowbefore tableinsertrowafter tabledeleterow | tableinsertcolbefore tableinsertcolafter tabledeletecol',
            table_default_attributes: { border: '1' }, table_default_styles: { width: '100%', borderCollapse: 'collapse' },
            content_style: 'body{box-sizing:border-box;width:100%;max-width:794px;min-height:1056px;margin:0 auto;padding:64px 56px;font-family:Georgia,serif;font-size:18px;line-height:1.8;color:#27364b}h1,h2,h3,h4{font-family:Arial,sans-serif;line-height:1.3;color:#182840}img{max-width:100%;height:auto}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccd5e0;padding:8px}blockquote{border-left:4px solid #7b91b6;padding-left:18px;color:#53647a}iframe{max-width:100%}@media(max-width:760px){body{min-height:480px;padding:32px 20px}}' + BLOCK_CSS,
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
                editor.ui.registry.addMenuButton('kpblocks', {
                    text: 'Blocks', tooltip: 'Insert a note, FAQ, button or table of contents',
                    fetch: (callback) => callback([
                        { type: 'menuitem', text: 'Note box', onAction: () => insertCallout('note', 'Note') },
                        { type: 'menuitem', text: 'Tip box', onAction: () => insertCallout('tip', 'Tip') },
                        { type: 'menuitem', text: 'Warning box', onAction: () => insertCallout('warning', 'Warning') },
                        { type: 'menuitem', text: 'FAQ (question and answer)', onAction: insertFaq },
                        { type: 'menuitem', text: 'Button link', onAction: insertButtonLink },
                        { type: 'menuitem', text: 'Table of contents (from H2/H3)', onAction: insertToc }
                    ])
                });
                editor.ui.registry.addButton('kpmedia', { text: 'Media', tooltip: 'Media library', onAction: openMedia });
                editor.addShortcut('meta+s', 'Save', quickSave);
                editor.on('input change undo redo', () => { updateWritingStats(); updateSeoReview(); markDirty(); });
                editor.on('init', onReady);
            }
        }).catch((error) => {
            console.error('Blog editor initialization failed:', error);
            setStatus('Editor failed to initialize', 'error');
            byId('blogMessage').textContent = 'The writing editor failed to initialize. Reload this page before writing.';
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!token()) return; // admin.js redirects to the login page
        FIELD_IDS.forEach((id) => byId(id)?.addEventListener('input', markDirty));
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
        document.addEventListener('keydown', (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); quickSave(); }
        });
        window.addEventListener('beforeunload', (event) => { if (dirty) { writeBackup(); event.preventDefault(); event.returnValue = ''; } });
        const blogId = new URLSearchParams(window.location.search).get('id');
        let started = false;
        initMainTinyMCE(() => {
            if (started) return;
            started = true;
            if (blogId) loadArticle(blogId); else startNewArticle();
        });
    });

    Object.assign(window, { saveBlog, previewBlog, setPreviewDevice, toggleWritingMode, toggleSettings, openMedia, loadMedia, openHistory });
})();
