# Why Travel Alone

## Introduction

Why Travel Alone is a small passion project that began as my capstone for the Brainstation June 2023 cohort. It has now evolved into an ongoing project where I can showcase my skills. In this back-end section of the project, I will demonstrate my ability to design comprehensive databased that use joined tables to gather and output data from multuiple sources. You can find the corresponding front-end API [here](https://github.com/JDVM/why-travel-alone.git).

## Technologies

- React
- JavaScript
- Axios
- SASS
- React Router DOM
- React Icons
- Knex
- MySQL

## Setup

### Front-End

1. Clone the repository: `https://github.com/JDVM/why-travel-alone.git`
2. Install dependencies: `npm install axios sass react-router-dom`
3. Run the application: `npm start`

### Back-end

1. Clone the repository: `https://github.com/JDVM/why-travel-alone-api.git`
2. Install dependencies: `npm install Knex dotenv express mysql2 cors`
3. Run the application: `node --watch server.js`

If you encounter any issues, please feel free to contact me via GitHub.

### Database Setup

- Create a database in MySQL
- Create an `.env` file using the `.env.example` file to format appropriate variables (screenshot)

- ![image](https://github.com/JDVM/why-travel-alone-api/assets/40014232/001c2c3d-c61c-4c1d-9907-44f9c6fb288c)

- In the terminal, run `npm run migrate` to apply the latest migration files
- Seed the database by running `npm run seed` to populate it with the latest data

## Features

- Trips: Add, Edit, Delete trips
- Traveler: Traveler Details, Add Travelers to trip, Delete travelers from trip
- Fully responsive with a mobile-first design

## Lessons Learned

The biggest lesson I learned from this project is the complexity of the backend design process. During the initial project design, I was not aware of how complex the queries would need to be in order to properly retrieve the data. Learning to use different joins as part of the query showed me that all of the data doesn't have to be in a single database; it can be in multiple sources and joined together based on the needs of the query. This also showed me that spreading the data out and creating multiple relationships can be beneficial.

For the frontend, I learned a few things as well. I found that combining the `map` method with a select option is very useful. I also learned about the different types of overflow options. While the initial plan was to use a library to create the frontend, in the end, I had to scrap that idea and create the components from scratch, as I was spending too much development time trying to figure out how they worked.

## Next Steps

**Milestones:**
1. Apply a sorting function to narrow down results based on different categories.
2. Add more icons to enhance user interface.
3. Implement hotel and flight search for the site.
