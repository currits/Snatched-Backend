import bcrypt from 'bcrypt';
import jwt from "jsonwebtoken";
import sequelize from '../utils/database';
import { DataTypes } from 'sequelize';

var User = require('../models/user')(sequelize, DataTypes);

