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
      "filter": "<any todoist valid filter">
    }
  ```
  5. Switch to preview mode
  6. You are done!
  
  ## Roadmap
  
  - [X] Task filtering with two-way sync
  - [X] Task rendering with labels, Projects, Priority and sections
  - [ ] Show due date
  - [ ] Support for grouping and sorting
  - [ ] Add tasks with predefined task meta (project, labels, priority, due)
  
    
