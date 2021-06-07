const todoistPlugin = (function() {
    const baseEndPoint = 'https://api.todoist.com/rest/v1/';
    let initialized = false;

    let projectCache = {};
    let labelCache = {};
    let sectionCache = {};

    // unable to override lodash template variable. Use o. everywhere
    const todoistItemTemplate = _.template(`
      <div class='todoist-item-container' id='<%= o.id %>' data-completed='<%= o.completed %> '>
        <div class='todoist-checkbox-container'>
            <% if(o.completed) { %>
              <input class='todoist-checkbox' type='checkbox' id='input-<%= o.id %>' checked=true >
            <% } else { %>
              <input class='todoist-checkbox' type='checkbox' id='input-<%= o.id %>'>
            <% } %>
            <label for='input-<%= o.id %>' data-priority='<%= o.priority %>'>
            </label>
        </div>
        <div class='todoist-content-container'>
          <div class='todoist-content'>
            <%= o.content %>
          </div>
          <div class='todoist-content-meta'>
              <div class='todoist-project' data-color='<%= o.project.color %>'>
                <span> <%= o.project.name %> </span>
                <% if (o.section_id) { %>
                  <span>&nbsp;/&nbsp;</span>
                  <span> <%= o.section.name %> </span>
                <% } %>
              </div>
              <div class='todoist-labels'>
                <% o.labels.forEach(function (label) { %>
                  <div class='todoist-label' data-color='<%= label.color %>'>
                    <%= label.name %>
                  </div>
                <% }) %>
              </div>
          </div>
        </div>
      </div>
    `)

    const todoistErrorTemplate = _.template(`<div class='todoist-error'> <%= o.data %> </div>`)

    const todoistInfoTemplate = _.template(`<div class='todoist-info'> <%= o.data %> </div>`)

    function getError(response) {
        let errorText = "";
        switch (response) {
            case "Empty token":
                errorText = "Please set todoist token in your custom JS. Please refer to documentation"
                break;
            case "NO_TOKEN":
                errorText = "Please set todoist token in your custom JS. Please refer to documentation"
                break;

            case "JSON_PARSE_ERROR":
                errorText = "JSON specified in the config is invalid. Please validate it"
        }
        return {
            status: "ERROR",
            data: errorText
        }
    }

    function setUpListener() {
        document.addEventListener("change", async function(event) {
            if (event.target.className === "todoist-checkbox") {

                event.stopPropagation();

                const container = event.target.parentElement.parentElement;
                const todoistId = container.id

                const status = event.target.checked;
                container.dataset.completed = status;
                let response;

                if (status) { // close
                    response = await syncData(`tasks/${todoistId}/close`, "POST");
                } else { // reopen
                    response = await syncData(`tasks/${todoistId}/reopen`, "POST");
                }

                if (response.status === "ERROR") {
                    event.target.checked = !!status; // revert status
                    container.dataset.completed = !!status;
                    alert('An error occured while syncing the data', response.data);
                }
            }
        })
    }

    async function syncData(endpoint, method) {
        const response = await fetch(`${baseEndPoint}${endpoint}`, {
            method: method || "GET",
            headers: {
                "Authorization": `Bearer ${window.TODOIST_TOKEN}`
            }
        });

        if (response.ok) {
            if (response.status !== 204) {
                const data = await response.json();
                return {
                    "status": "SUCCESS",
                    "data": data
                }
            } else {
                return {
                    "status": "SUCCESS",
                    "data": null
                }
            }

        } else {
            const text = await response.text();
            return getError(text)
        }
    }

    async function refreshMetaCache(name) {
        const data = await syncData(name);

        if (data.status === "SUCCESS") {
            const cache = {}
            data.data.forEach(item => {
                cache[item.id] = item;
            })
            return cache;
        } else {
            alert(`An error occured while refresh Todoist ${name}`, data.data)
            return {}
        }
    }

    async function refreshLabelsCache() {
        labelCache = await refreshMetaCache('labels');
    }

    async function refreshProjectsCache() {
        projectCache = await refreshMetaCache('projects');
    }

    async function refreshSectionsCache() {
        sectionCache = await refreshMetaCache('sections');
    }

    function prepareAndGetRuntimeContainer(node) {
        // node is code element. Hierarchy as follows
        /*
          <div class="copy-wrapper">
            <div class="copy"><div>
            <pre>
              <code class="language-todoist">
                  OUR NODE
              </code>
            </pre>
            INSERT RUNTIME HERE
          </div>
        */
        const preElement = node.parentElement;
        const copyContainer = preElement.parentElement;

        let copyContainerClassName = copyContainer.className;

        if (copyContainerClassName.indexOf('todoist-runtime-host') === -1) {
            copyContainerClassName += " todoist-runtime-host";
            copyContainer.className = copyContainerClassName;
        }

        // add required classes always

        let runTimeContainer;

        if (preElement.nextElementSibling) {
            runTimeContainer = preElement.nextElementSibling;

            if (runTimeContainer.className === "todoist-runtime") {
                runTimeContainer.innerHTML = ""; // clear data
                return runTimeContainer;
            }
        }

        runTimeContainer = document.createElement('div');
        runTimeContainer.className = "todoist-runtime";

        copyContainer.append(runTimeContainer);

        return runTimeContainer;
    }

    function renderError(node, error) {
        const container = prepareAndGetRuntimeContainer(node);

        container.innerHTML = todoistErrorTemplate(error);
    }

    async function render(node, filter) {
        if (!initialized) {
            renderError(node, getError('NO_TOKEN'))
            return
        }

        const response = await syncData(`tasks?filter=${encodeURIComponent(filter)}`);

        if (response.status === 'ERROR') {
            renderError(node, response);
            return;
        }

        const container = prepareAndGetRuntimeContainer(node);

        const items = response.data;

        if (!items.length) {
            container.innerHTML = todoistInfoTemplate({ data: 'Yaay! No tasks' });
            return;
        }

        const projectIdsInCache = _.keys(projectCache).map(key => parseInt(key));
        const labelsInCache = _.keys(labelCache).map(key => parseInt(key));
        const sectionsInCache = _.keys(sectionCache).map(key => parseInt(key));

        // version of underscore doesn't support chain. Use nested functions
        const projectIds = _.map(items, item => item.project_id);
        const labelIds = _.flatten(_.map(items, item => item.label_ids));
        const sectionIds = _.map(items, item => item.section_id);

        if (_.difference(projectIds, projectIdsInCache).length) {
            await refreshProjectsCache();
        }

        if (_.difference(labelIds, labelsInCache).length) {
            await refreshLabelsCache();
        }

        // exclude 0 from section Ids as it signifies no section
        if (_.difference(_.without(sectionIds, 0), sectionsInCache).length) {
            await refreshSectionsCache();
        }



        let html = '';
        items.forEach(item => {
            // update project
            item.project = projectCache[item.project_id];

            item.labels = item.label_ids.map(labelId => {
                return labelCache[labelId];
            });

            if (item.section_id) {
                item.section = sectionCache[item.section_id];
            }

            html += todoistItemTemplate(item);
        });

        container.innerHTML = html;
    }

    return {
        initialize: async function() {
            if (window.TODOIST_TOKEN) {
                initialized = true;

                setUpListener();

                await refreshProjectsCache();
                await refreshLabelsCache();
                await refreshSectionsCache();

            } else {
                initialized = false;
            }

            return initialized;
        },

        renderItems: function(node, filter) {
            render(node, filter);
        },

        renderError: function(node, error) {
            renderError(node, getError(error))
        }
    }
})()

const renderItems = function(nodes) {
    console.log(`render item actual`);
    nodes.forEach(node => {
        try {
            const jsonBody = JSON.parse(node.innerText.replace(/\s/g, ""))
            const filter = jsonBody.filter || ""

            todoistPlugin.renderItems(node, filter);
        } catch (error) {
            todoistPlugin.renderError(node, 'JSON_PARSE_ERROR')
        }
    })
}

todoistPlugin.initialize();

const debouncedRenderItems = _.debounce(renderItems, 1000, { leading: true })

const observer = new MutationObserver(function(mutationRecords) {
    mutationRecords.forEach(record => {
        if (record.type === "childList") {
            record.addedNodes.forEach(node => {
                if (node.nodeType === 1 && node.querySelectorAll('.language-todoist').length) {
                    debouncedRenderItems(document.querySelectorAll('.language-todoist')); // render everythng in page
                }
            })
        }
    })
});

const element = document.querySelector('body');

observer.observe(element, {
    childList: true,
    subtree: true
})