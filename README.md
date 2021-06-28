# notable-todoist

Todoist integration with [Notable](https://notable.app/) note talking application.

## Usage guide

1. Download latest version of the app (at the time of writing, supports latest beta release onwards)
2. Open custom css / js
3. Copy paste the following
  - In Custom JS
    ```
    window.TODOIST_TOKEN = '<YOUR_TODOIST_TOKEN>'
    ```
    [index.js](/index.js) from the repository
 - In Custom CSS
    [index.css](/index.css) from the repository
    
4. Open a note in edit mode and create custom code block with name **todoist** as follows
  
  ```todoist
   {
      "mode": "filter",
      "filter": {
        "query": "<any todoist valid filter>"
      }
    }
  ```
  5. Switch to preview mode
  6. You are done!

  ## Advanced usage
  Notable todoist supports three types of modes. Just like todoist. 
  1. filter
  2. project
  3. label

  ### Mode **filter**
  This mode is similar to todoist filter. One can configure any valid [todoist filter](https://todoist.com/help/articles/introduction-to-filters).
  To use filters set *mode* to *filter* and create a json object with key *filter*. The json object should have a key called *query* which contains actual filter query.
  Checkout the example below

  ```todoist
  {
    "mode": "filter",
      "filter": {
        "query": "(today | overdue) & #Work"
      }
  }
  ```

  ### Mode **project**
  This mode is similar to todoist Projects. One can browse all tasks associated with the project or a section of the project here. 
  The configuration is similar to filter. Set *mode* to *project* and create a json object with key *project*. The json object should have a key called *query* which contains *project name* or *project/section name*. 
  Checkout the example below

  1. Browsing tasks in a project
  ```todoist
  {
    "mode": "project",
      "project": {
        "query": "Work"
      }
  }
  ```
  2. Browsing tasks of a section in project
  ```todoist
  {
    "mode": "project",
      "project": {
        "query": "Work/Section"
      }
  }
  ```
  > Project name doesn't start with **#** as it does in filter mode
  
  ### Mode **label**
  This mode is similar to todoist Labels. One can browse all tasks associated with a label
  The configuration is similar to mode project and label. Set *mode* to *label* and create a json object with key *label*. The json object should have a key called *query* which specifes the label name.
  Checkout the example below
  ```todoist
  {
    "mode": "label",
      "label": {
        "query": "events"
      }
  }
  ```
  > label name doesn't start with **@** as it does in filter mode 

  ### Sorting and Grouping
  All the three modes support various types of sorting and grouping. To configure, please create keys called **groupBy**, **sortBy**, **sortOrder**. Checkout the example below
  ```todoist
  {
    "mode": "project",
      "project": {
        "query": "Work",
        "groupBy": "section",
        "sortBy": "priority",
        "sortOrder": "desc"
      }
  }
  ```
  The available grouping and sorting options for each mode is different. Checkout the table below
  | Mode    | Allowed Grouping options                | Allowed Sorting options                  | Allowed sort orders |
  |---------|-----------------------------------------|------------------------------------------|---------------------|
  | filter  | project, priority, date, none (default) | order (default), date, priority, content | asc, desc           |
  | project | section, priority, date, none (default) | order (default), date, priority, content | asc, desc           |
  | label   | project, priority, date, none (default) | order (default), date, priority, content | asc, desc           |

  ## Roadmap
  
  - [X] Task filtering with two-way sync
  - [X] Task rendering with labels, Projects, Priority and sections
  - [ ] Show due date
  - [X] Support for grouping and sorting
  - [ ] Auto refresh (as of now refresh happens only when swicthed from edit mode to preview mode)
  - [ ] Add tasks with predefined task meta (project, labels, priority, due)
  
    
