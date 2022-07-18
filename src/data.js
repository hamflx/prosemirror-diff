export const oldDocState = {
  type: 'doc',
  attrs: {
    id: null
  },
  content: [
    {
      type: 'heading',
      attrs: {
        textAlign: 'left',
        id: 'json5--json-for-humans',
        level: 1
      },
      content: [
        {
          type: 'text',
          text: 'JSON5 – JSON for Humans'
        }
      ]
    },
    {
      type: 'paragraph',
      attrs: {
        textAlign: 'left',
        id: 'lIpNA54afs7RG2U6H5yob'
      },
      content: [
        {
          type: 'text',
          text: 'The JSON5 Data Interchange Format (JSON5) is a superset of '
        },
        {
          type: 'text',
          marks: [
            {
              type: 'link',
              attrs: {
                href: 'https://tools.ietf.org/html/rfc7159',
                target: '_blank',
                class: null
              }
            }
          ],
          text: 'JSON'
        },
        {
          type: 'text',
          text: ' that aims to alleviate some of the limitations of JSON by expanding its syntax to include some productions from '
        },
        {
          type: 'text',
          marks: [
            {
              type: 'link',
              attrs: {
                href: 'https://www.ecma-international.org/ecma-262/5.1/',
                target: '_blank',
                class: null
              }
            }
          ],
          text: 'ECMAScript 5.1'
        },
        {
          type: 'text',
          text: '.'
        }
      ]
    },
    {
      type: 'heading',
      attrs: {
        textAlign: 'left',
        id: 'summary-of-features',
        level: 2
      },
      content: [
        {
          type: 'text',
          text: 'Summary of Features'
        }
      ]
    },
    {
      type: 'paragraph',
      attrs: {
        textAlign: 'left',
        id: 'iHgdo2pni3b8elPl2uh2c'
      }
    },
    {
      type: 'heading',
      attrs: {
        textAlign: 'left',
        id: 'objects',
        level: 3
      },
      content: [
        {
          type: 'text',
          text: 'Objects'
        }
      ]
    },
    {
      type: 'bulletList',
      attrs: {
        id: 'QxZDHHwXFHhSjU0ClnI9v'
      },
      content: [
        {
          type: 'listItem',
          attrs: {
            id: 'MTWugSjhCk2uyTpt3Xctw'
          },
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: 'left',
                id: 'ImFosXz3T1KBxet7Qa6gC'
              },
              content: [
                {
                  type: 'text',
                  text: 'Object keys may be an ECMAScript 5.1 '
                },
                {
                  type: 'text',
                  marks: [
                    {
                      type: 'link',
                      attrs: {
                        href: 'https://www.ecma-international.org/ecma-262/5.1/#sec-7.6',
                        target: '_blank',
                        class: null
                      }
                    },
                    {
                      type: 'italic'
                    }
                  ],
                  text: 'IdentifierName'
                },
                {
                  type: 'text',
                  text: '.'
                }
              ]
            }
          ]
        },
        {
          type: 'listItem',
          attrs: {
            id: 'UgO0gR00YT1vMtNDnQRRV'
          },
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: 'left',
                id: 'IpophWPf2EMC7e9jLJ8KQ'
              },
              content: [
                {
                  type: 'text',
                  text: 'Objects may have a single trailing comma.'
                }
              ]
            }
          ]
        }
      ]
    },
    {
      type: 'heading',
      attrs: {
        textAlign: 'left',
        id: 'arrays',
        level: 3
      },
      content: [
        {
          type: 'text',
          text: 'Arrays'
        }
      ]
    },
    {
      type: 'bulletList',
      attrs: {
        id: '0bgYAm5pHKDVRkI6SYx52'
      },
      content: [
        {
          type: 'listItem',
          attrs: {
            id: 'hk772H7X-xEDfxklgbLLY'
          },
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: 'left',
                id: 'zqxEHGiDHxS0jHHpaFb4j'
              },
              content: [
                {
                  type: 'text',
                  text: 'Arrays may have a single trailing comma.'
                }
              ]
            }
          ]
        }
      ]
    },
    {
      type: 'heading',
      attrs: {
        textAlign: 'left',
        id: 'strings',
        level: 3
      },
      content: [
        {
          type: 'text',
          text: 'Strings'
        }
      ]
    },
    {
      type: 'bulletList',
      attrs: {
        id: 'YCT4-A1b0K2fPDhz-dzxX'
      },
      content: [
        {
          type: 'listItem',
          attrs: {
            id: 's1t07dWe0dUGNXHxLcsye'
          },
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: 'left',
                id: 'DQNH79ebdrmlvfq95XdhA'
              },
              content: [
                {
                  type: 'text',
                  text: 'Strings may be single quoted.'
                }
              ]
            }
          ]
        },
        {
          type: 'listItem',
          attrs: {
            id: 'mlugN18BZTtXea4caYNI4'
          },
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: 'left',
                id: 'Ec7RBuIFkJhUBAtdazQR2'
              },
              content: [
                {
                  type: 'text',
                  text: 'Strings may span multiple lines by escaping new line characters.'
                }
              ]
            }
          ]
        },
        {
          type: 'listItem',
          attrs: {
            id: 'Cmx0ZqVM23OSWE7r9x95U'
          },
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: 'left',
                id: 'N8-HZMCaREGYydRTtIAD-'
              },
              content: [
                {
                  type: 'text',
                  text: 'Strings may include character escapes.'
                }
              ]
            }
          ]
        }
      ]
    },
    {
      type: 'heading',
      attrs: {
        textAlign: 'left',
        id: 'numbers',
        level: 3
      },
      content: [
        {
          type: 'text',
          text: 'Numbers'
        }
      ]
    },
    {
      type: 'bulletList',
      attrs: {
        id: 'YYWklAymqdP3M7_foMGpi'
      },
      content: [
        {
          type: 'listItem',
          attrs: {
            id: 'eqKFdtoFMG2wGGGv-eNHF'
          },
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: 'left',
                id: '656msI_iyXV_rTouwLmhD'
              },
              content: [
                {
                  type: 'text',
                  text: 'Numbers may be hexadecimal.'
                }
              ]
            }
          ]
        },
        {
          type: 'listItem',
          attrs: {
            id: 'hIMfKTzn9aiwptisfikE_'
          },
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: 'left',
                id: 'BWGhWorfMJDb0SZRMxMHP'
              },
              content: [
                {
                  type: 'text',
                  text: 'Numbers may have a leading or trailing decimal point.'
                }
              ]
            }
          ]
        },
        {
          type: 'listItem',
          attrs: {
            id: '7-0GOFURChShT4mpmsDvV'
          },
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: 'left',
                id: 'BM0t9oBcER7fQJaY7ztPX'
              },
              content: [
                {
                  type: 'text',
                  text: 'Numbers may be '
                },
                {
                  type: 'text',
                  marks: [
                    {
                      type: 'link',
                      attrs: {
                        href: 'http://ieeexplore.ieee.org/servlet/opac?punumber=4610933',
                        target: '_blank',
                        class: null
                      }
                    }
                  ],
                  text: 'IEEE 754'
                },
                {
                  type: 'text',
                  text: ' positive infinity, negative infinity, and NaN.'
                }
              ]
            }
          ]
        },
        {
          type: 'listItem',
          attrs: {
            id: '-7m8jPIp3vTA9VjPML7sh'
          },
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: 'left',
                id: 'HhB2SQGyLLUYCiwgaMYx5'
              },
              content: [
                {
                  type: 'text',
                  text: 'Numbers may begin with an explicit plus sign.'
                }
              ]
            }
          ]
        }
      ]
    },
    {
      type: 'heading',
      attrs: {
        textAlign: 'left',
        id: 'comments',
        level: 3
      },
      content: [
        {
          type: 'text',
          text: 'Comments'
        }
      ]
    },
    {
      type: 'bulletList',
      attrs: {
        id: 'IOX3wV0XPTYbqjYu7ryuA'
      },
      content: [
        {
          type: 'listItem',
          attrs: {
            id: '1QDRkf1unAzbUykCMI_TQ'
          },
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: 'left',
                id: 'oQKvCNVFsa91SREPNlSDM'
              },
              content: [
                {
                  type: 'text',
                  text: 'Single and multi-line comments are allowed.'
                }
              ]
            }
          ]
        }
      ]
    },
    {
      type: 'heading',
      attrs: {
        textAlign: 'left',
        id: 'white-space',
        level: 3
      },
      content: [
        {
          type: 'text',
          text: 'White Space'
        }
      ]
    },
    {
      type: 'bulletList',
      attrs: {
        id: 'PMlPTuD31KJ6MvMOIqs0w'
      },
      content: [
        {
          type: 'listItem',
          attrs: {
            id: 'hNLNc5n-QD0Bt3JnDNKeT'
          },
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: 'left',
                id: 'CosMbECTJnB3rCjUACG8U'
              },
              content: [
                {
                  type: 'text',
                  text: 'Additional white space characters are allowed.'
                }
              ]
            }
          ]
        }
      ]
    },
    {
      type: 'paragraph',
      attrs: {
        textAlign: 'left',
        id: 'ygVy0Z2TmJcKmbDTftKpW'
      }
    }
  ]
}

export const newDocState = {
  type: 'doc',
  attrs: {
    id: null
  },
  content: [
    {
      type: 'heading',
      attrs: {
        textAlign: 'left',
        id: 'json5--json-for-humans',
        level: 1
      },
      content: [
        {
          type: 'text',
          text: 'JSON5 – JSON for Humans'
        }
      ]
    },
    {
      type: 'paragraph',
      attrs: {
        textAlign: 'left',
        id: 'lIpNA54afs7RG2U6H5yob'
      },
      content: [
        {
          type: 'text',
          text: 'The JSON6 Data Interchange Format (JSON6) is a superset of '
        },
        {
          type: 'text',
          marks: [
            {
              type: 'link',
              attrs: {
                href: 'https://tools.ietf.org/html/rfc7159',
                target: '_blank',
                class: null
              }
            }
          ],
          text: 'JSON'
        },
        {
          type: 'text',
          text: ' that aims to alleviate some of the limitations of JSON by expanding its syntax to include some productions from '
        },
        {
          type: 'text',
          marks: [
            {
              type: 'link',
              attrs: {
                href: 'https://www.ecma-international.org/ecma-262/5.1/',
                target: '_blank',
                class: null
              }
            }
          ],
          text: 'ECMAScript 5.1'
        },
        {
          type: 'text',
          text: '.'
        }
      ]
    },
    {
      type: 'paragraph',
      attrs: {
        textAlign: 'left',
        id: 'FIbcLGqcjawWOzD3oOfAG'
      },
      content: [
        {
          type: 'text',
          text: 'This JavaScript library is the official reference implementation for JSON6 parsing and serialization libraries.'
        }
      ]
    },
    {
      type: 'heading',
      attrs: {
        textAlign: 'left',
        id: 'summary-of-features',
        level: 2
      },
      content: [
        {
          type: 'text',
          text: 'Summary of Features'
        }
      ]
    },
    {
      type: 'paragraph',
      attrs: {
        textAlign: 'left',
        id: 'iHgdo2pni3b8elPl2uh2c'
      }
    },
    {
      type: 'paragraph',
      attrs: {
        textAlign: 'left',
        id: 'CTvk2zsYUgqOTEjB_FV_K'
      },
      content: [
        {
          type: 'text',
          text: 'The following ECMAScript 5.1 features, which are not supported in JSON, have been extended to JSON5.'
        }
      ]
    },
    {
      type: 'heading',
      attrs: {
        textAlign: 'left',
        id: 'objects',
        level: 3
      },
      content: [
        {
          type: 'text',
          text: 'Objects'
        }
      ]
    },
    {
      type: 'bulletList',
      attrs: {
        id: 'QxZDHHwXFHhSjU0ClnI9v'
      },
      content: [
        {
          type: 'listItem',
          attrs: {
            id: 'MTWugSjhCk2uyTpt3Xctw'
          },
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: 'left',
                id: 'ImFosXz3T1KBxet7Qa6gC'
              },
              content: [
                {
                  type: 'text',
                  text: 'Object keys may be an ECMAScript 5.1 '
                },
                {
                  type: 'text',
                  marks: [
                    {
                      type: 'link',
                      attrs: {
                        href: 'https://www.ecma-international.org/ecma-262/5.1/#sec-7.6',
                        target: '_blank',
                        class: null
                      }
                    },
                    {
                      type: 'italic'
                    }
                  ],
                  text: 'IdentifierName'
                },
                {
                  type: 'text',
                  text: '.'
                }
              ]
            }
          ]
        },
        {
          type: 'listItem',
          attrs: {
            id: 'UgO0gR00YT1vMtNDnQRRV'
          },
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: 'left',
                id: 'IpophWPf2EMC7e9jLJ8KQ'
              },
              content: [
                {
                  type: 'text',
                  text: 'Objects may have a single trailing comma.'
                }
              ]
            }
          ]
        }
      ]
    },
    {
      type: 'heading',
      attrs: {
        textAlign: 'left',
        id: 'arrays',
        level: 3
      },
      content: [
        {
          type: 'text',
          text: 'Arrays'
        }
      ]
    },
    {
      type: 'bulletList',
      attrs: {
        id: '0bgYAm5pHKDVRkI6SYx52'
      },
      content: [
        {
          type: 'listItem',
          attrs: {
            id: 'hk772H7X-xEDfxklgbLLY'
          },
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: 'left',
                id: 'zqxEHGiDHxS0jHHpaFb4j'
              },
              content: [
                {
                  type: 'text',
                  text: 'Arrays may have a single trailing comma.'
                }
              ]
            }
          ]
        }
      ]
    },
    {
      type: 'heading',
      attrs: {
        textAlign: 'left',
        id: 'strings',
        level: 3
      },
      content: [
        {
          type: 'text',
          text: 'Strings'
        }
      ]
    },
    {
      type: 'bulletList',
      attrs: {
        id: 'YCT4-A1b0K2fPDhz-dzxX'
      },
      content: [
        {
          type: 'listItem',
          attrs: {
            id: 's1t07dWe0dUGNXHxLcsye'
          },
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: 'left',
                id: 'DQNH79ebdrmlvfq95XdhA'
              },
              content: [
                {
                  type: 'text',
                  text: 'Strings may be single quoted.'
                }
              ]
            }
          ]
        },
        {
          type: 'listItem',
          attrs: {
            id: 'mlugN18BZTtXea4caYNI4'
          },
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: 'left',
                id: 'Ec7RBuIFkJhUBAtdazQR2'
              },
              content: [
                {
                  type: 'text',
                  text: 'Strings may span multiple lines by escaping new line characters.'
                }
              ]
            }
          ]
        },
        {
          type: 'listItem',
          attrs: {
            id: 'Cmx0ZqVM23OSWE7r9x95U'
          },
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: 'left',
                id: 'N8-HZMCaREGYydRTtIAD-'
              },
              content: [
                {
                  type: 'text',
                  text: 'Strings may include character escapes.'
                }
              ]
            }
          ]
        }
      ]
    },
    {
      type: 'heading',
      attrs: {
        textAlign: 'left',
        id: 'numbers',
        level: 3
      },
      content: [
        {
          type: 'text',
          text: 'Numbers'
        }
      ]
    },
    {
      type: 'bulletList',
      attrs: {
        id: 'YYWklAymqdP3M7_foMGpi'
      },
      content: [
        {
          type: 'listItem',
          attrs: {
            id: 'eqKFdtoFMG2wGGGv-eNHF'
          },
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: 'left',
                id: '656msI_iyXV_rTouwLmhD'
              },
              content: [
                {
                  type: 'text',
                  text: 'Numbers may be hexadecimal.'
                }
              ]
            }
          ]
        },
        {
          type: 'listItem',
          attrs: {
            id: 'hIMfKTzn9aiwptisfikE_'
          },
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: 'left',
                id: 'BWGhWorfMJDb0SZRMxMHP'
              },
              content: [
                {
                  type: 'text',
                  text: 'Numbers may have a leading or trailing decimal point.'
                }
              ]
            }
          ]
        },
        {
          type: 'listItem',
          attrs: {
            id: '7-0GOFURChShT4mpmsDvV'
          },
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: 'left',
                id: 'BM0t9oBcER7fQJaY7ztPX'
              },
              content: [
                {
                  type: 'text',
                  text: 'Numbers may be '
                },
                {
                  type: 'text',
                  marks: [
                    {
                      type: 'link',
                      attrs: {
                        href: 'http://ieeexplore.ieee.org/servlet/opac?punumber=4610933',
                        target: '_blank',
                        class: null
                      }
                    }
                  ],
                  text: 'IEEE 754'
                },
                {
                  type: 'text',
                  text: ' positive infinity, negative infinity, and NaN.'
                }
              ]
            }
          ]
        },
        {
          type: 'listItem',
          attrs: {
            id: '-7m8jPIp3vTA9VjPML7sh'
          },
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: 'left',
                id: 'HhB2SQGyLLUYCiwgaMYx5'
              },
              content: [
                {
                  type: 'text',
                  text: 'Numbers may begin with an explicit plus sign.'
                }
              ]
            }
          ]
        }
      ]
    },
    {
      type: 'heading',
      attrs: {
        textAlign: 'left',
        id: 'comments',
        level: 3
      },
      content: [
        {
          type: 'text',
          text: 'Comments'
        }
      ]
    },
    {
      type: 'bulletList',
      attrs: {
        id: 'IOX3wV0XPTYbqjYu7ryuA'
      },
      content: [
        {
          type: 'listItem',
          attrs: {
            id: '1QDRkf1unAzbUykCMI_TQ'
          },
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: 'left',
                id: 'oQKvCNVFsa91SREPNlSDM'
              },
              content: [
                {
                  type: 'text',
                  text: 'Single and multi-line comments are allowed.'
                }
              ]
            }
          ]
        }
      ]
    },
    {
      type: 'heading',
      attrs: {
        textAlign: 'left',
        id: 'white-space',
        level: 3
      },
      content: [
        {
          type: 'text',
          text: 'White Space'
        }
      ]
    },
    {
      type: 'bulletList',
      attrs: {
        id: 'PMlPTuD31KJ6MvMOIqs0w'
      },
      content: [
        {
          type: 'listItem',
          attrs: {
            id: 'hNLNc5n-QD0Bt3JnDNKeT'
          },
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: 'left',
                id: 'CosMbECTJnB3rCjUACG8U'
              },
              content: [
                {
                  type: 'text',
                  text: 'Additional white space characters are allowed.'
                }
              ]
            }
          ]
        }
      ]
    },
    {
      type: 'paragraph',
      attrs: {
        textAlign: 'left',
        id: 'ygVy0Z2TmJcKmbDTftKpW'
      }
    }
  ]
}
