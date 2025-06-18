export const comoFunciona = [
  {
    title: 'Cadastro do Anunciante',
    description: 'O usuário começa informando os dados da empresa anunciante, incluindo:',
    items: [
      'CNPJ (se correto, será exibido o nome da empresa)',
      'Nome da empresa',
      'E-mail',
      'Telefone'
    ]
  },
  {
    title: 'Detalhamento do Anúncio',
    description: 'Em seguida, o usuário deve preencher os dados do anúncio, como:',
    items: [
      'Título do anúncio',
      'Descrição completa',
      'Data de início e término da veiculação'
    ]
  },
  {
    title: 'Solicitação de Orçamento',
    description: 'Após inserir os detalhes, o usuário poderá solicitar um orçamento. Nesse momento, ele visualizará:',
    items: [
      'A quantidade máxima de visualizações por dia',
      'A possibilidade de selecionar o número desejado de visualizações',
      'O sistema calculará automaticamente o valor com base na taxa fixa de R$ 0,01 por visualização'
    ],
    subItems: [
      'Opções disponíveis: 100, 500, 1.000, 5.000',
      'Ou uma quantidade personalizada'
    ]
  },
  {
    title: 'Informações Adicionais',
    description: 'O usuário deverá informar:',
    items: [
      'O público-alvo desejado',
      'O método de pagamento (com acréscimo de 5% para cartão de crédito)',
      'Uma ou mais imagens para o anúncio',
      'Um ou mais links relacionados ao conteúdo anunciado'
    ]
  },
  {
    title: 'Envio e Aprovação',
    description: '',
    items: [
      'O usuário deverá aceitar os termos de uso',
      'Em seguida, poderá enviar o contrato do anúncio para análise',
      'Após avaliação, o anúncio será publicado como uma postagem normal'
    ]
  },
  {
    title: 'Exibição e Validade',
    description: '',
    items: [
      'A diferença para uma postagem comum está na frequência de exibição, que será maior durante a campanha',
      'Após o fim do período estipulado, o anúncio sairá automaticamente do ar',
      'O usuário terá a opção de renovar o contrato para manter o anúncio ativo por mais tempo'
    ]
  }
]; 