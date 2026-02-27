// ===== ADMIN BLOGS FUNCTIONS =====

// Load all blogs

console.log('✅ Admin Blogs module started loading');

// Check if API_BASE is available
if (typeof API_BASE === 'undefined') {
    console.warn('API_BASE not found, using default');
    var API_BASE = window.location.hostname === 'localhost'
        ? 'http://localhost:5000'
        : 'https://student-education-portal-backend.onrender.com';
}

// Ensure all required functions exist
window.loadBlogs = async function () {
    console.log('loadBlogs called');
    try {
        // ... rest of your loadBlogs code
    } catch (err) {
        console.error('loadBlogs error:', err);
    }
};


async function loadBlogs() {
    try {
        const token = getToken('admin');
        if (!token) {
            showAlert('Please login again', 'error');
            return;
        }

        const blogsContainer = document.getElementById('blogsList');
        if (!blogsContainer) return;

        blogsContainer.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading blogs...</p>
            </div>
        `;

        const response = await fetch(API_BASE + '/api/blogs');
        const data = await response.json();

        if (!data.success) {
            blogsContainer.innerHTML = `<p>Failed to load blogs</p>`;
            return;
        }

        const blogs = data.blogs || [];

        if (blogs.length === 0) {
            blogsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-blog"></i>
                    <p>No blogs found. Create your first blog!</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="papers-table-container">
                <table class="papers-table">
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Category</th>
                            <th>Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        blogs.forEach(blog => {
            const date = blog.createdAt
                ? new Date(blog.createdAt).toLocaleDateString('en-IN')
                : '-';

            html += `
                <tr>
                    <td><strong>${blog.title}</strong></td>
                    <td>${blog.category || '-'}</td>
                    <td>${date}</td>
                    <td>
                        <a href="/blog.html?slug=${blog.slug}" 
                        target="_blank" 
                        class="btn btn-view">
                            <i class="fas fa-eye"></i> View
                        </a>

                        <button class="btn btn-edit" 
                                onclick="openEditBlog('${blog._id}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>

                        <button class="btn btn-delete" 
                                onclick="deleteBlog('${blog._id}', '${blog.title.replace(/'/g, "\\'")}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        blogsContainer.innerHTML = html;

    } catch (err) {
        console.error(err);
        showAlert('Failed to load blogs', 'error');
    }
}

// Delete blog
async function deleteBlog(blogId, blogTitle) {
    showConfirm(
        `Are you sure you want to delete "${blogTitle}"?`,
        async function () {
            try {
                const token = getToken('admin');
                const response = await fetch(API_BASE + '/api/blogs/' + blogId, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': 'Bearer ' + token
                    }
                });

                const data = await response.json();

                if (data.success) {
                    showAlert('Blog deleted successfully!', 'success');
                    loadBlogs();
                } else {
                    showAlert('Failed to delete blog', 'error');
                }
            } catch (err) {
                showAlert('Server error', 'error');
            }
        }
    );
}

// Open edit blog modal
async function openEditBlog(blogId) {
    try {
        const token = getToken('admin');

        const res = await fetch(API_BASE + '/api/blogs/id/' + blogId, {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        const data = await res.json();

        if (!data.success) {
            showAlert('Failed to load blog', 'error');
            return;
        }

        const blog = data.blog;

        document.getElementById('editBlogId').value = blog._id;
        document.getElementById('editBlogTitle').value = blog.title;
        document.getElementById('editBlogCategory').value = blog.category || '';
        document.getElementById('editBlogImage').value = blog.image || '';

        setTimeout(() => {
            const editor = tinymce.get('editBlogContent');
            if (editor) {
                editor.setContent(blog.content);
            }
        }, 500);

        showModal('editBlogModal');

    } catch (err) {
        showAlert('Server error: ' + err.message, 'error');
    }
}

// ========== ENHANCED TINYMCE INITIALIZATION ==========
// Initialize TinyMCE for main blog editor - MS WORD LIKE
// Initialize TinyMCE for main blog editor - FIXED VERSION
function initMainTinyMCE() {
    if (document.getElementById('blogContent') && !tinymce.get('blogContent')) {
        tinymce.init({
            selector: '#blogContent',
            height: 700,
            menubar: true,
            branding: false,
            resize: 'both',
            elementpath: true,

            // FIX Z-INDEX ISSUE
            zIndex: 999999,

            // ✅ FIXED PLUGINS LIST (removed missing plugins)
            plugins: [
                'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                'insertdatetime', 'media', 'table', 'help', 'wordcount', 'emoticons',
                'directionality', 'pagebreak', 'nonbreaking', 'codesample'
            ],

            // ✅ FIXED TOOLBAR (removed missing plugin buttons)
            toolbar: [
                'undo redo | styles | bold italic underline strikethrough | forecolor backcolor | fontfamily fontsize',
                'alignleft aligncenter alignright alignjustify | outdent indent | numlist bullist | blockquote',
                'link image media table | pagebreak | charmap emoticons | code fullscreen preview | help'
            ].join(' | '),

            // STYLES (HEADINGS, PARAGRAPHS)
            style_formats: [
                { title: 'Paragraph', format: 'p' },
                { title: 'Heading 1', format: 'h1' },
                { title: 'Heading 2', format: 'h2' },
                { title: 'Heading 3', format: 'h3' },
                { title: 'Heading 4', format: 'h4' },
                { title: 'Heading 5', format: 'h5' },
                { title: 'Heading 6', format: 'h6' },
                { title: 'Preformatted', format: 'pre' },
                { title: 'Code', format: 'code' }
            ],

            // FONT OPTIONS
            font_family_formats: 'Arial=arial,helvetica,sans-serif; Arial Black=arial black,avant garde; Book Antiqua=book antiqua,palatino; Comic Sans MS=comic sans ms,sans-serif; Courier New=courier new,courier; Georgia=georgia,palatino; Helvetica=helvetica; Impact=impact,chicago; Symbol=symbol; Tahoma=tahoma,arial,helvetica,sans-serif; Terminal=terminal,monaco; Times New Roman=times new roman,times; Trebuchet MS=trebuchet ms,geneva; Verdana=verdana,geneva;',

            font_size_formats: '8pt 10pt 12pt 14pt 16pt 18pt 20pt 22pt 24pt 26pt 28pt 36pt 48pt 72pt',

            // IMAGE SETTINGS
            image_advtab: true,
            image_caption: true,
            image_title: true,
            automatic_uploads: true,
            images_upload_url: API_BASE + '/api/blogs/upload-image',
            images_upload_handler: function (blobInfo, progress) {
                return new Promise((resolve, reject) => {
                    const token = getToken('admin');
                    if (!token) {
                        reject({ message: 'Not authenticated', remove: true });
                        return;
                    }

                    const formData = new FormData();
                    formData.append('image', blobInfo.blob(), blobInfo.filename());

                    fetch(API_BASE + '/api/blogs/upload-image', {
                        method: 'POST',
                        headers: {
                            'Authorization': 'Bearer ' + token
                        },
                        body: formData
                    })
                        .then(response => response.json())
                        .then(data => {
                            if (data.success && data.url) {
                                resolve(data.url);
                            } else {
                                reject({ message: data.message || 'Upload failed', remove: true });
                            }
                        })
                        .catch(error => {
                            reject({ message: error.message, remove: true });
                        });
                });
            },

            // IMAGE CLASSES
            image_class_list: [
                { title: 'None', value: '' },
                { title: 'Left (Text Wrap)', value: 'img-left' },
                { title: 'Right (Text Wrap)', value: 'img-right' },
                { title: 'Center (Block)', value: 'img-center' },
                { title: 'Square Wrap', value: 'img-square' },
                { title: 'Border', value: 'img-border' },
                { title: 'Shadow', value: 'img-shadow' }
            ],

            // TABLE SETTINGS
            table_default_attributes: { border: '1' },
            table_default_styles: { width: '100%', borderCollapse: 'collapse' },
            table_class_list: [
                { title: 'None', value: '' },
                { title: 'Striped Rows', value: 'table-striped' },
                { title: 'Bordered', value: 'table-bordered' },
                { title: 'Hover Rows', value: 'table-hover' }
            ],
            table_advtab: true,
            table_cell_advtab: true,
            table_row_advtab: true,
            table_resize_bars: true,

            // REMOVED: table_column_resizing (causing warning)

            // QUICK BARS
            quickbars_selection_toolbar: 'bold italic underline | forecolor backcolor | formatselect | blockquote quicklink',
            quickbars_insert_toolbar: 'quickimage quicktable | pagebreak',
            quickbars_image_toolbar: 'alignleft aligncenter alignright | imageoptions',

            // CONTEXT MENU
            contextmenu: 'link image table',

            // CONTENT CSS
            content_css: [
                '//fonts.googleapis.com/css?family=Lato:300,300i,400,400i',
                '/css/blog.css'
            ],

            // SETUP
            setup: function (editor) {
                editor.on('init', function (e) {
                    console.log('TinyMCE initialized');
                });
            }
        });
        console.log('✅ Enhanced TinyMCE Fully Initialized');
    }
}
// Initialize TinyMCE for edit blog editor
function initEditTinyMCE() {
    if (document.getElementById('editBlogContent') && !tinymce.get('editBlogContent')) {
        tinymce.init({
            selector: '#editBlogContent',
            height: 600,
            menubar: true,
            branding: false,
            zIndex: 999999, // FIX Z-INDEX
            plugins: [
                'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                'insertdatetime', 'media', 'table', 'help', 'wordcount', 'emoticons',
                'directionality', 'hr', 'pagebreak', 'nonbreaking', 'anchor', 'toc',
                'imagetools', 'editimage', 'quickbars', 'codesample'
            ],
            toolbar: 'undo redo | styles | bold italic underline | forecolor backcolor | alignleft aligncenter alignright | bullist numlist | link image table | code fullscreen',
            image_advtab: true,
            image_caption: true,
            automatic_uploads: true,
            images_upload_url: API_BASE + '/api/blogs/upload-image',
            images_upload_handler: function (blobInfo, progress) {
                return new Promise((resolve, reject) => {
                    const token = getToken('admin');
                    if (!token) {
                        reject({ message: 'Not authenticated', remove: true });
                        return;
                    }

                    const formData = new FormData();
                    formData.append('image', blobInfo.blob(), blobInfo.filename());

                    fetch(API_BASE + '/api/blogs/upload-image', {
                        method: 'POST',
                        headers: {
                            'Authorization': 'Bearer ' + token
                        },
                        body: formData
                    })
                        .then(response => response.json())
                        .then(data => {
                            if (data.success && data.url) {
                                resolve(data.url);
                            } else {
                                reject({ message: data.message || 'Upload failed', remove: true });
                            }
                        })
                        .catch(error => {
                            reject({ message: error.message, remove: true });
                        });
                });
            }
        });
    }
}

// Submit new blog
async function submitBlog() {
    const title = document.getElementById('blogTitle').value.trim();
    const editor = tinymce.get('blogContent');
    const content = editor ? editor.getContent().trim() : '';
    const category = document.getElementById('blogCategory').value.trim();
    const imageUrl = document.getElementById('blogImageUrl').value.trim();
    const imageFile = document.getElementById('blogImageFile').files[0];
    const messageDiv = document.getElementById('blogMessage');

    if (!title || !content) {
        messageDiv.innerHTML = '<span style="color: red;">❌ Title and Content required</span>';
        return;
    }

    const token = getToken('admin');
    if (!token) {
        showAlert('Session expired. Please login again.', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('content', content);
    formData.append('category', category);

    if (imageFile) {
        formData.append('image', imageFile);
    } else if (imageUrl) {
        formData.append('imageUrl', imageUrl);
    }

    try {
        messageDiv.innerHTML = '<span style="color: blue;">⏳ Publishing...</span>';

        const res = await fetch(API_BASE + '/api/blogs', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token
            },
            body: formData
        });

        const data = await res.json();

        if (data.success) {
            messageDiv.innerHTML = '<span style="color: green;">✅ Blog Published Successfully</span>';

            document.getElementById('blogTitle').value = '';
            document.getElementById('blogCategory').value = '';
            document.getElementById('blogImageUrl').value = '';
            document.getElementById('blogImageFile').value = '';
            if (editor) {
                editor.setContent('');
            }

            loadBlogs();

            setTimeout(() => {
                messageDiv.innerHTML = '';
            }, 3000);
        } else {
            messageDiv.innerHTML = '<span style="color: red;">❌ Failed: ' + (data.message || 'Unknown error') + '</span>';
        }

    } catch (err) {
        messageDiv.innerHTML = '<span style="color: red;">❌ Server Error: ' + err.message + '</span>';
    }
}

// Submit edited blog
async function submitEditBlog(e) {
    e.preventDefault();

    const blogId = document.getElementById('editBlogId').value;
    const title = document.getElementById('editBlogTitle').value.trim();
    const category = document.getElementById('editBlogCategory').value.trim();

    const editor = tinymce.get('editBlogContent');
    const content = editor ? editor.getContent().trim() : '';
    const image = document.getElementById('editBlogImage').value.trim();

    if (!title || !content) {
        showAlert('Title and content required', 'error');
        return;
    }

    try {
        const token = getToken('admin');

        const res = await fetch(API_BASE + '/api/blogs/' + blogId, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ title, content, category, image })
        });

        const data = await res.json();

        if (data.success) {
            showAlert('Blog updated successfully!', 'success');
            hideModal('editBlogModal');
            loadBlogs();
        } else {
            showAlert('Failed to update blog: ' + (data.message || 'Unknown error'), 'error');
        }

    } catch (err) {
        showAlert('Server error: ' + err.message, 'error');
    }
}

// Make functions globally available
window.loadBlogs = loadBlogs;
window.deleteBlog = deleteBlog;
window.openEditBlog = openEditBlog;
window.submitBlog = submitBlog;
window.submitEditBlog = submitEditBlog;
window.initMainTinyMCE = initMainTinyMCE;
window.initEditTinyMCE = initEditTinyMCE;