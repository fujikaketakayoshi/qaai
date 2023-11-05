import {Sequelize, DataTypes } from 'sequelize';

const sequelize = new Sequelize({
	database: 'qaai',
	username: 'fjkk',
	password: null,
	host: '127.0.0.1',
	dialect: 'mysql',
	timezone: '+09:00'
});

const Question = sequelize.define('Question', {
	url: {
		type: DataTypes.STRING,
		allowNull: false,
		unique: true
	},
	title: {
		type: DataTypes.TEXT
	},
	body: {
	type: DataTypes.TEXT
	}
});

await Question.sync();
//await Question.sync({force: true});

export {sequelize, Question};