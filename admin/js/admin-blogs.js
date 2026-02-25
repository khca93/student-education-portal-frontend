// ===== ADMIN BLOGS FUNCTIONS =====

// Load all blogs
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

// Initialize TinyMCE for main blog editor
function initMainTinyMCE() {
    if (document.getElementById('blogContent') && !tinymce.get('blogContent')) {
        tinymce.init({
            selector: '#blogContent',
            height: 600,
            branding: false,
            plugins: 'advlist autolink lists link image table code fullscreen',
            toolbar: `
                undo redo |
                bold italic underline |
                alignleft aligncenter alignright |
                bullist numlist |
                image table |
                code fullscreen
            `,
            automatic_uploads: true,
            image_advtab: true,
            image_caption: true,
            image_title: true,
            object_resizing: true,
            images_upload_handler: function (blobInfo) {
                return new Promise((resolve, reject) => {
                    const token = getToken('admin');
                    if (!token) {
                        reject('Not authenticated');
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
                        .then(res => res.json())
                        .then(data => {
                            if (data.success && data.url) {
                                resolve(data.url);
                            } else {
                                reject(data.message || 'Upload failed');
                            }
                        })
                        .catch(err => reject(err.message));
                });
            },
            image_class_list: [
                { title: 'Default (Block)', value: '' },
                { title: 'Left Wrap', value: 'img-left' },
                { title: 'Right Wrap', value: 'img-right' },
                { title: 'Square Wrap', value: 'img-square' }
            ],
            content_style: `
                body { font-family: Arial; font-size:16px; line-height:1.6 }
                img.img-left {
                    float: left;
                    margin: 10px 20px 10px 0;
                    max-width: 50%;
                }
                img.img-right {
                    float: right;
                    margin: 10px 0 10px 20px;
                    max-width: 50%;
                }
                img.img-square {
                    float: left;
                    margin: 10px;
                    max-width: 40%;
                    shape-outside: margin-box;
                }
                img {
                    max-width: 100%;
                    height: auto;
                    cursor: move;
                }
            `
        });
        console.log('✅ TinyMCE Fully Initialized');
    }
}

// Initialize TinyMCE for edit blog editor
function initEditTinyMCE() {
    if (document.getElementById('editBlogContent') && !tinymce.get('editBlogContent')) {
        tinymce.init({
            selector: '#editBlogContent',
            height: 500,
            plugins: 'table image link',
            toolbar: 'undo redo | bold italic | bullist numlist | table | image',
            branding: false,
            images_upload_handler: function (blobInfo) {
                return new Promise((resolve, reject) => {
                    const token = getToken('admin');
                    if (!token) {
                        reject('Not authenticated');
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
                        .then(res => res.json())
                        .then(data => {
                            if (data.success && data.url) {
                                resolve(data.url);
                            } else {
                                reject(data.message || 'Upload failed');
                            }
                        })
                        .catch(err => reject(err.message));
                });
            }
        });
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