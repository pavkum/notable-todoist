const todoistPlugin = (function() {
    const baseEndPoint = 'https://api.todoist.com/rest/v1/';
    const syncEndPoint = 'https://api.todoist.com/sync/v8/sync';
    let initialized = false;

    let syncToken = '*'; // initial valuel

    let projectCache = {};
    let labelCache = {};
    let sectionCache = {};

    const todoistSectionTemplate = _.template(`
      <div class='todoist-section-container'>
        <div class='todoist-section-name'>
          <%= o.name %>
        </div>
        <div class='todoist-section-items'>
          <%= o.html %>
        </div>
      </div>
    `)

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
            <% if (o.children && o.children.length) { %>
                <div class='todoist-expand-collapse' data-target='<%= o.id %>'></div>
            <% } %>
        </div>
        <div class='todoist-content-container'>
          <div class='todoist-content'>
            <%= o.content %>
          </div>
          <% if (!o.parent_id) { %>
            <div class='todoist-content-meta'>
                <div class='todoist-project' data-color='<%= o.project.color %>'>
                    <span> 
                    <%= o.project.name %> 
                    </span>
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
          <% } else { %>
            <div class='todoist-content-meta'></div>
          <% } %>
          <% if (o.children && o.children.length) { %>
            <div class='todoist-item-children'>
              <% o.children.forEach(child => { %>
                <%= o.todoistItemTemplate(child) %> 
              <% }) %>
          </div>
          <% } %>
        </div>
      </div>
    `)

    const todoistErrorTemplate = _.template(`<div class='todoist-error'> <%= o.data %> </div>`)

    const todoistInfoTemplate = _.template(`<div class='todoist-info'> <%= o.data %> </div>`)

    function getError(id) {
        let errorText = "";
        switch (id) {
            case "Empty token":
                errorText = "Please set todoist token in your custom JS. Please refer to documentation"
                break;
            case "NO_TOKEN":
                errorText = "Please set todoist token in your custom JS. Please refer to documentation"
                break;

            case "JSON_PARSE_ERROR":
                errorText = "JSON specified in the config is invalid. Please validate it"
                break;

            case "INVALID_LABEL":
                errorText = "Label specified in the config doesn't exists or not created"
                break;

            case "INVALID_PROJECT":
                errorText = "Project specified in the config doesn't exists or not created"
                break;

            case "INVALID_SECTION":
                errorText = "Section specified in the config doesn't exists or not created"
                break;

            case "INVALID_SECTION_FOR_PROJECT":
                errorText = "Section specified does't below to the project in the config. Please check";
                break;

            case "INVALID_PROJECT_GROUPBY":
            case "INVALID_PROJECT_SORTBY":
            case "INVALID_LABEL_GROUPBY":
            case "INVALID_LABEL_SORTBY":
            case "INVALID_FILTER_GROUPBY":
            case "INVALID_FILTER_SORTBY":
            case "INVALID_MODE":
            case "INVALID_CONFIG":
                errorText = "Invalid todoist config. Please refer to https://github.com/pavkum/notable-todoist/blob/main/README.md for more information"
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
                    response = await syncDataViaRestAPI(`tasks/${todoistId}/close`, "POST");
                } else { // reopen
                    response = await syncDataViaRestAPI(`tasks/${todoistId}/reopen`, "POST");
                }

                if (response.status === "ERROR") {
                    event.target.checked = !!status; // revert status
                    container.dataset.completed = !!status;
                    alert('An error occured while syncing the data', response.data);
                }
            }
        })

        document.addEventListener('click', function(event) {
            if (event.target.className === "todoist-expand-collapse") {
                event.stopPropagation();

                const id = event.target.dataset.target;

                const parent = document.getElementById(id);

                if (parent.dataset.expanded === "true") {
                    parent.dataset.expanded = "false";
                } else {
                    parent.dataset.expanded = "true";
                }
            }
        })
    }

    async function getMetaViaSyncAPI() {
        const response = await fetch(`${syncEndPoint}?sync_token=${syncToken}&resource_types=${JSON.stringify(['projects', 'labels', 'sections'])}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${window.TODOIST_TOKEN}`
            }
        });

        if (response.ok) {
            const data = await response.json();

            return {
                "status": "SUCCESS",
                "data": data
            }

        } else {
            const text = await response.text();
            return getError(text)
        }
    }

    async function syncDataViaRestAPI(endpoint, method) {
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

    async function refreshMeta() {
        const response = await getMetaViaSyncAPI();

        if (response.status === "ERROR") {
            alert('An error occured while syncing the data');
            return;
        }

        syncToken = response.data.sync_token;

        refreshMetaByCache(response.data, 'projects', projectCache);
        refreshMetaByCache(response.data, 'sections', sectionCache);
        refreshMetaByCache(response.data, 'labels', labelCache);
    }

    function refreshMetaByCache(response, name, cache) {
        const array = response[name] || [];
        array.forEach(obj => {
            cache[obj.id] = obj
        });
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

    function validateConfig(config) {
        const status = {
            status: "ERROR",
            description: null
        }

        try {
            let groupBy = config[config.mode]['groupBy'] || "none";
            let sortBy = config[config.mode]['sortBy'] || "order";
            switch (config.mode) {
                case "project":
                    // allowed groups
                    if (['section', 'priority', 'date', "none"].indexOf(groupBy) === -1) {
                        status.description = "INVALID_PROJECT_GROUPBY"
                    }

                    // allowed sort
                    if (['order', 'date', 'priority', 'content'].indexOf(sortBy) === -1) {
                        status.description = "INVALID_PROJECT_SORTBY"
                    }

                    break;
                case "label":
                    // allowed groups
                    if (['project', 'priority', 'date', "none"].indexOf(groupBy) === -1) {
                        status.description = "INVALID_LABEL_GROUPBY"
                    }

                    // allowed sort
                    if (['order', 'date', 'priority', 'content'].indexOf(sortBy) === -1) {
                        status.description = "INVALID_LABEL_SORTBY"
                    }
                    break;
                case "filter":
                    // allowed groups
                    if (['project', 'priority', 'date', "none"].indexOf(groupBy) === -1) {
                        status.description = "INVALID_FILTER_GROUPBY"
                    }

                    // allowed sort
                    if (['order', 'date', 'priority', 'content'].indexOf(sortBy) === -1) {
                        status.description = "INVALID_FILTER_SORTBY"
                    }
                    break;

                default:
                    status.description = "INVALID_MODE"
            }
        } catch (error) {
            status.description = "INVALID_CONFIG"
        }

        if (!status.description) {
            status.status = "SUCCESS";
        }

        return status;
    }

    function sortBy(items, config) {
        let sorted;
        switch (config.sortBy) {
            case "date":
                sorted = items.sort(function(first, second) {
                    // No due should always come last
                    // if asc - default date = 2038-12-31
                    // if desc - default date = 1971-01-01

                    let defaultDate = null;
                    if (config.sortOrder === "asc") {
                        defaultDate = {
                            date: "2038-12-31"
                        }
                    } else {
                        defaultDate = {
                            date: "1971-01-01"
                        }
                    }

                    const firstDue = first.due || defaultDate;
                    const secondDue = second.due || defaultDate;

                    const firsDate = new Date(firstDue.datetime || firstDue.date);
                    const secondDate = new Date(secondDue.datetime || secondDue.date);

                    if (config.sortOrder === "asc") {
                        return firsDate - secondDate;
                    } else {
                        return secondDate - firsDate;
                    }

                })
                break;
            case "priority":
                sorted = items.sort(function(first, second) {
                    // priority is in reverse order. 1 means least and 4 means higher
                    if (config.sortOrder === "asc") {
                        return second.priority - first.priority;
                    } else {
                        return first.priority - second.priority;
                    }
                })
                break;


            case "content":
                sorted = items.sort(function(first, second) {
                    if (config.sortOrder === "asc") {
                        if (first.content > second.content) {
                            return 1;
                        } else if (first.content < second.content) {
                            return -1;
                        } else {
                            return 0;
                        }
                    } else {
                        if (first.content > second.content) {
                            return -1;
                        } else if (first.content < second.content) {
                            return 1;
                        } else {
                            return 0;
                        }
                    }
                })
                break;

            case "order": // case order is the default
            default:
                sorted = items.sort(function(first, second) {
                    if (config.sortOrder === "asc") {
                        return first.order - second.order;
                    } else {
                        return second.order - first.order;
                    }
                });
                break;
        }

        return sorted;
    }

    function groupBy(items, config) {
        let groups = [];

        switch (config.groupBy) {
            case "date":
                const today = new Date();
                const groupByDate = _.groupBy(items, function(item) {
                    const due = item.due;
                    let itemDate;

                    if (due) {
                        itemDate = due.datetime || due.date;
                        itemDate = new Date(itemDate);
                    }

                    if (!due) {
                        return "No Date"
                    } else if (itemDate.getDate() === today.getDate() && itemDate.getMonth() === today.getMonth() && itemDate.getFullYear() === today.getFullYear()) {
                        // compare today to easily calculate overdue and upcoming
                        return "Today";
                    } else if (itemDate < today) {
                        return "Overdue";
                    } else if (itemDate > today) {
                        return "Upcoming";
                    } else {
                        // wont come here
                    }
                });
                // order manually
                groups = {
                    "Overdue": groupByDate['Overdue'] || [],
                    "Today": groupByDate['Today'] || [],
                    "Upcoming": groupByDate['Upcoming'] || [],
                    "No Date": groupByDate['No Date'] || [],
                }
                break;

            case "section":
                groups = _.groupBy(items, function(item) {
                    // assumes all the cache is refreshed
                    if (item.section_id === 0) {
                        return "No Section";
                    } else {
                        return sectionCache[item.section_id].name
                    }
                });
                break;

            case "project":
                groups = _.groupBy(items, function(item) {
                    // assumes all the cache is refreshed
                    return projectCache[item.project_id].name
                });
                break;

            case "priority":
                const priorityGroups = _.groupBy(items, function(item) {
                    // assumes all the cache is refreshed
                    let priority; // API priority is in reverse order
                    switch (item.priority) {
                        case 4:
                            priority = 'P1';
                            break;

                        case 3:
                            priority = 'P2';
                            break;

                        case 2:
                            priority = 'P3';
                            break;

                        case 1:
                            priority = 'P4';
                            break;

                        default:
                            priority = 'P4';
                            break;
                    }
                    return priority;
                });
                // group by doesn't guarantee order. Arrange manually
                groups = {
                    "P1": priorityGroups['P1'] || [],
                    "P2": priorityGroups['P2'] || [],
                    "P3": priorityGroups['P3'] || [],
                    "P4": priorityGroups['P4'] || [],
                }
                break;
            default:
                // for none
                groups = items
        }

        return groups;
    }

    function recursivelyPopulateItemChildren(item, childItems, config) {
        let filteredChildItems = _.filter(childItems, childItem => {
            return childItem.parent_id === item.id;
        });

        filteredChildItems = sortBy(filteredChildItems, config);

        filteredChildItems.forEach(childItem => {
            childItem = getItemWithMeta(childItem);
            recursivelyPopulateItemChildren(childItem, childItems, config);
        });

        item.children = filteredChildItems;

        return item;
    }

    function getItemWithMeta(item) {
        item.project = projectCache[item.project_id];

        item.labels = item.label_ids.map(labelId => {
            return labelCache[labelId];
        });

        if (item.section_id) {
            item.section = sectionCache[item.section_id];
        }

        item.todoistItemTemplate = todoistItemTemplate; // hack as I'm not able to directly set as template helper

        return item;
    }


    function getObjByName(name, cache) {
        const keys = Object.keys(cache);

        let matchedKey = -1;
        for (let i = 0; i < keys.length; i++) {
            if (cache[keys[i]].name === name) {
                matchedKey = keys[i];
                break;
            }
        }

        return cache[matchedKey];
    }

    async function render(node, config) {
        if (!initialized) {
            renderError(node, getError('NO_TOKEN'))
            return
        }

        const configValidity = validateConfig(config);

        if (configValidity.status === "ERROR") {
            renderError(node, getError(configValidity.description));
            return;
        }

        // check modes
        let query;
        const configQuery = config[config.mode]['query'] || "";
        switch (config.mode) {
            case "filter":
                query = `filter=${encodeURIComponent(configQuery)}`;
                break;

            case "project":
                const projectParts = configQuery.split("/");
                let projectName = projectParts[0];
                let sectionName = projectParts[1];

                let project = getObjByName(projectName, projectCache);

                if (!project) {
                    // give it another try
                    await refreshMeta();
                }

                project = getObjByName(projectName, projectCache);

                if (!project) {
                    renderError(node, getError('INVALID_PROJECT'))
                    return;
                }

                let section;
                if (sectionName) {
                    section = getObjByName(projectParts[1], sectionCache);
                }

                if (sectionName && !section) {
                    renderError(node, getError('INVALID_SECTION'));
                    return;
                }

                if (sectionName && section && section.project_id === project.id) {
                    // preference is for section filtering
                    query = `section_id=${section.id}`
                } else if (sectionName && section && section.project_id !== project.id) {
                    renderError(node, getError('INVALID_SECTION_FOR_PROJECT'));
                    return;
                } else {
                    query = `project_id=${project.id}`
                }

                break;

            case "label":
                let label = getObjByName(configQuery, labelCache);

                if (!label) {
                    // give it another try
                    await refreshMeta();
                }

                label = getObjByName(configQuery, labelCache);

                if (!label) {
                    renderError(node, getError('INVALID_LABEL'))
                    return;
                }

                query = `label_id=${label.id}`;
                break;

            default:
                // wont come here
        }

        const response = await syncDataViaRestAPI(`tasks?${query}`);

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
            await refreshMeta();
        }

        if (_.difference(labelIds, labelsInCache).length) {
            await refreshMeta();
        }

        // exclude 0 from section Ids as it signifies no section
        if (_.difference(_.without(sectionIds, 0), sectionsInCache).length) {
            await refreshMeta();
        }


        let parentChildTasks = {};

        if (config.mode === "project") {
            parentChildTasks = _.groupBy(items, item => {
                if (!!item.parent_id) {
                    return "child";
                } else {
                    return "parent";
                }
            });
        } else {
            parentChildTasks = {
                "parent": items
            }
        }

        // group top level tasks
        let groups = groupBy(parentChildTasks.parent, config[config.mode]);

        if (_.isArray(groups)) {
            // no group. Just a section
            // create dummy section for looping
            groups = {
                "-1": groups
            }
        }

        // loop through sections and sort
        const containerFragment = document.createDocumentFragment();

        // append dummy element
        const dummyElement = document.createElement('div');
        dummyElement.id = 'dummy';

        containerFragment.append(dummyElement);

        const sections = Object.keys(groups);
        sections.forEach(section => { // _.each is not exposed. Use loop
            let sectionItems = groups[section];

            if (section !== "-1" && sectionItems.length === 0) {
                return;
            }

            // sort items
            sectionItems = sortBy(sectionItems, config[config.mode]);

            // render items
            let html = "";
            sectionItems.forEach(item => {
                // update project
                item = getItemWithMeta(item);

                // recursively identify child tasks
                item = recursivelyPopulateItemChildren(item, parentChildTasks.child || [], config[config.mode]);
                // create dummy element for appending to fragment
                html += todoistItemTemplate(item);
            });

            // render items
            if (section === "-1") {
                // no section
                containerFragment.querySelector('#dummy').innerHTML = html;
            } else {
                containerFragment.querySelector('#dummy').innerHTML += todoistSectionTemplate({
                    name: section,
                    html: html
                })
            }
        });

        container.innerHTML = containerFragment.querySelector('#dummy').innerHTML;
    }

    return {
        initialize: async function() {
            if (window.TODOIST_TOKEN) {
                initialized = true;

                setUpListener();

                await refreshMeta();
            } else {
                initialized = false;
            }

            return initialized;
        },

        renderItems: function(node, config) {
            render(node, config);
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
            // converted html is using &nbsp; as whitespace character. It is removing whitespace characters in between quotes
            // first replace whitepsace chars by a dummy sequence. Replace all whitespaces and then convert dummy sequence to actual space
            const jsonBody = JSON.parse(node.innerText.replace(/\w+\s+\w+/g, function(x) { return x.replace(/\s/g, "----") }).replace(/\s/g, '').replace(/----/g, ' '))

            todoistPlugin.renderItems(node, jsonBody);
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