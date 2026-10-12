import mysql from 'mysql2';

export default class Database {
    static #pool = mysql.createPool({
        host: '132.226.245.178', // endereço do nosso banco de dados na nuvem
        database: 'PFS2_10442417542',
        user: '10442417542',
        password: '10442417542',
        idleTimeout: 30000,
        connectionLimit: 50
    });

    #conexao;
    #conexaoTransacao;

    get conexao() { return this.#conexao; }
    set conexao(conexao) { this.#conexao = conexao; }

    constructor() {
        this.#conexao = Database.#pool;
        this.#conexaoTransacao = null;
    }

    #obterConexao() {
        return this.#conexaoTransacao ?? this.#conexao;
    }

    ExecutaComando(sql, valores) {
        const cnn = this.#obterConexao();
        return new Promise(function(res, rej) {
            cnn.query(sql, valores, function(error, results) {
                if (error) rej(error);
                else res(results);
            });
        });
    }

    ExecutaComandoNonQuery(sql, valores) {
        const cnn = this.#obterConexao();
        return new Promise(function(res, rej) {
            cnn.query(sql, valores, function(error, results) {
                if (error) rej(error);
                else res(results.affectedRows > 0);
            });
        });
    }

    ExecutaComandoLastInserted(sql, valores) {
        const cnn = this.#obterConexao();
        return new Promise(function(res, rej) {
            cnn.query(sql, valores, function(error, results) {
                if (error) rej(error);
                else res(results.insertId);
            });
        });
    }

    AbreTransacao() {
        if (this.#conexaoTransacao) {
            return Promise.reject(new Error('Já existe uma transação aberta.'));
        }

        return new Promise((res, rej) => {
            this.#conexao.getConnection((erroConexao, conexao) => {
                if (erroConexao) return rej(erroConexao);

                conexao.beginTransaction(erroTransacao => {
                    if (erroTransacao) {
                        conexao.release();
                        return rej(erroTransacao);
                    }
                    this.#conexaoTransacao = conexao;
                    res();
                });
            });
        });
    }

    Rollback() {
        const cnn = this.#conexaoTransacao;
        if (!cnn) return Promise.reject(new Error('Não existe uma transação aberta.'));

        return new Promise(res => {
            cnn.rollback(() => {
                cnn.release();
                this.#conexaoTransacao = null;
                res();
            });
        });
    }

    Commit() {
        const cnn = this.#conexaoTransacao;
        if (!cnn) return Promise.reject(new Error('Não existe uma transação aberta.'));

        return new Promise((res, rej) => {
            cnn.commit(error => {
                if (error) {
                    return cnn.rollback(() => {
                        cnn.release();
                        this.#conexaoTransacao = null;
                        rej(error);
                    });
                }
                cnn.release();
                this.#conexaoTransacao = null;
                res();
            });
        });
    }
}
